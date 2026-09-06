import {
  CustomerRequestStatus,
  DiscountReviewStatus,
  InvoiceStatus,
  Prisma,
  QuoteAuditAction,
  QuoteStatus,
  RecommendationStatus,
  SubscriptionStatus,
} from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";
import { calculateTotals } from "./quote.service";
import { releaseAllocationsForQuote } from "./inventory.service";
import { cancelSubscription } from "./subscription.service";
import type {
  AcceptRecommendationInput,
  CreateMyRequestInput,
  NegotiateQuoteInput,
} from "../validation/customerPortal.validation";

function toNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

type OrderStatus = "IN_PROGRESS" | "APPROVED" | "CANCELLED";

// A customer's own view of their orders is deliberately collapsed to three
// states: CANCELLED once the customer has withdrawn it, APPROVED only once
// the linked quote has cleared every approval stage (Admin's master
// sign-off included), and IN_PROGRESS for everything else - no quote yet,
// still mid-approval-chain, returned, or even rejected - since in every one
// of those cases the order is still something the customer may need to act
// on (see the Negotiations tab and the Cancel Order action).
function deriveOrderStatus(
  request: { status: CustomerRequestStatus },
  quoteStatus: QuoteStatus | null | undefined
): OrderStatus {
  if (request.status === CustomerRequestStatus.CANCELLED) return "CANCELLED";
  if (quoteStatus === QuoteStatus.APPROVED) return "APPROVED";
  return "IN_PROGRESS";
}

const ORDER_INCLUDE = {
  items: { include: { product: true } },
  quote: {
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      // Filtered relation count - only recommendations actually sent to the
      // customer count as a pending notification on the order row; ones
      // still awaiting the Sales Rep's own review, or already
      // accepted/declined, don't need a badge.
      _count: { select: { recommendations: { where: { status: RecommendationStatus.SENT_TO_CUSTOMER } } } },
      // Only ever consulted for a MANAGER_CANCELLED entry (see
      // formatOrderListItem) - a Manager/Admin unwinding a confirmed order
      // from Deal Health is unprompted news to the customer and needs a
      // reason, unlike their own CUSTOMER_CANCELLED (they already know why).
      auditEntries: { orderBy: { createdAt: "desc" as const }, take: 1 },
    },
  },
} satisfies Prisma.CustomerRequestInclude;

type OrderRow = Prisma.CustomerRequestGetPayload<{ include: typeof ORDER_INCLUDE }>;

function formatOrderListItem(request: OrderRow) {
  const latestEntry = request.quote?.auditEntries[0];
  return {
    id: request.id,
    status: deriveOrderStatus(request, request.quote?.status),
    quote: request.quote ? { id: request.quote.id, quoteNumber: request.quote.quoteNumber } : null,
    items: request.items.map((item) => ({
      productName: item.product.name,
      quantity: item.requestedQuantity,
    })),
    expectedDiscountPercentage: toNumber(request.expectedDiscountPercentage),
    notes: request.notes,
    shippingLocation: request.shippingLocation,
    cancellationReason:
      request.status === CustomerRequestStatus.CANCELLED && latestEntry?.action === QuoteAuditAction.MANAGER_CANCELLED
        ? latestEntry.note
        : null,
    createdAt: request.createdAt,
    pendingRecommendationCount: request.quote?._count.recommendations ?? 0,
  };
}

export async function listMyOrders(customerId: string) {
  const requests = await prisma.customerRequest.findMany({
    where: { customerId },
    include: ORDER_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  return requests.map(formatOrderListItem);
}

export async function getMyOrderDetail(orderId: string, customerId: string) {
  const request = await prisma.customerRequest.findUnique({
    where: { id: orderId },
    include: ORDER_INCLUDE,
  });
  if (!request) {
    throw ApiError.notFound("Order not found");
  }
  if (request.customerId !== customerId) {
    throw ApiError.forbidden("You can only view your own orders");
  }

  const status = deriveOrderStatus(request, request.quote?.status);

  const recommendations = request.quote
    ? await prisma.quoteRecommendation.findMany({
        where: { quoteId: request.quote.id, status: RecommendationStatus.SENT_TO_CUSTOMER },
        include: { product: true },
        orderBy: { createdAt: "asc" },
      })
    : [];

  return {
    ...formatOrderListItem(request),
    // Only an order still IN_PROGRESS can be cancelled - once APPROVED it's
    // confirmed (subscriptions/invoices already exist for it), and it can't
    // be cancelled twice.
    cancellable: status === "IN_PROGRESS",
    items: request.items.map((item) => ({
      productName: item.product.name,
      sku: item.product.sku,
      quantity: item.requestedQuantity,
      unitPrice: Number(item.product.unitPrice),
    })),
    recommendations: recommendations.map((rec) => ({
      id: rec.id,
      type: rec.type,
      reason: rec.reason,
      product: {
        id: rec.product.id,
        name: rec.product.name,
        sku: rec.product.sku,
        category: rec.product.category,
        unitPrice: Number(rec.product.unitPrice),
      },
    })),
  };
}

/**
 * Withdraws an order the customer no longer wants. If it's already been
 * quoted, the linked quote moves to CANCELLED too (distinct from an
 * approver's REJECTED) - this pulls it out of any approval queue it's
 * currently sitting in, rather than leaving a zombie approval item behind
 * for a request the customer has withdrawn.
 */
export async function cancelMyOrder(
  orderId: string,
  customerId: string,
  userId: string,
  reason: string | undefined
) {
  await prisma.$transaction(async (tx) => {
    const request = await tx.customerRequest.findUnique({
      where: { id: orderId },
      include: { quote: true },
    });
    if (!request) {
      throw ApiError.notFound("Order not found");
    }
    if (request.customerId !== customerId) {
      throw ApiError.forbidden("You can only cancel your own orders");
    }

    const status = deriveOrderStatus(request, request.quote?.status);
    if (status === "APPROVED") {
      throw ApiError.badRequest("This order has already been approved and can no longer be cancelled");
    }
    if (status === "CANCELLED") {
      throw ApiError.badRequest("This order is already cancelled");
    }

    const result = await tx.customerRequest.updateMany({
      where: { id: orderId, status: request.status },
      data: { status: CustomerRequestStatus.CANCELLED },
    });
    if (result.count === 0) {
      throw ApiError.conflict("This order just changed - please refresh and try again");
    }

    if (request.quote) {
      const quoteResult = await tx.quote.updateMany({
        where: { id: request.quote.id, status: request.quote.status },
        data: { status: QuoteStatus.CANCELLED },
      });
      if (quoteResult.count > 0) {
        await tx.quoteAuditEntry.create({
          data: {
            quoteId: request.quote.id,
            userId,
            action: QuoteAuditAction.CUSTOMER_CANCELLED,
            note: reason?.trim() || "Cancelled by customer",
          },
        });
        // The order won't be fulfilled from this reservation - free the
        // stock back up for other orders.
        await releaseAllocationsForQuote(tx, request.quote.id);
      }
    }
  });

  return getMyOrderDetail(orderId, customerId);
}

// Every one of this customer's subscriptions regardless of status - unlike
// the old ACTIVE-only list, cancelled/paused ones stay visible for history
// (and so a cancelled one's detail page still works after the fact).
export async function listMySubscriptions(customerId: string) {
  const subscriptions = await prisma.subscription.findMany({
    where: { customerId },
    include: { product: true },
    orderBy: [{ status: "asc" }, { nextBillingDate: "asc" }],
  });

  return subscriptions.map((sub) => ({
    id: sub.id,
    productName: sub.product.name,
    quantity: sub.quantity,
    unitPrice: Number(sub.unitPrice),
    billingCycle: sub.billingCycle,
    status: sub.status,
    nextBillingDate: sub.nextBillingDate,
  }));
}

// Blocks a second plan-change request from being opened against the same
// subscription while an earlier one hasn't reached a terminal outcome yet
// (mirrors the "one pending tier-change at a time" rule in
// customerTierChange.service.ts). A request with no quote yet (still
// NEW/IN_REVIEW) always blocks; once it has a quote, only that quote's own
// status decides whether the attempt is still "in flight."
const TERMINAL_QUOTE_STATUSES: QuoteStatus[] = [QuoteStatus.APPROVED, QuoteStatus.REJECTED, QuoteStatus.CANCELLED];

async function hasPendingPlanChange(subscriptionId: string): Promise<boolean> {
  const requests = await prisma.customerRequest.findMany({
    where: { modifiesSubscriptionId: subscriptionId, status: { not: CustomerRequestStatus.CANCELLED } },
    include: { quote: { select: { status: true } } },
  });
  return requests.some((r) => !r.quote || !TERMINAL_QUOTE_STATUSES.includes(r.quote.status));
}

export async function getMySubscriptionDetail(subscriptionId: string, customerId: string) {
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { product: true, events: { orderBy: { createdAt: "desc" } } },
  });
  if (!sub) {
    throw ApiError.notFound("Subscription not found");
  }
  if (sub.customerId !== customerId) {
    throw ApiError.forbidden("You can only view your own subscriptions");
  }

  const pendingPlanChange = await hasPendingPlanChange(subscriptionId);
  const isActive = sub.status === SubscriptionStatus.ACTIVE;

  return {
    id: sub.id,
    productId: sub.productId,
    productName: sub.product.name,
    sku: sub.product.sku,
    quantity: sub.quantity,
    unitPrice: Number(sub.unitPrice),
    billingCycle: sub.billingCycle,
    status: sub.status,
    startDate: sub.startDate,
    nextBillingDate: sub.nextBillingDate,
    cancellable: isActive,
    // Blocked while a plan change is already in flight - approving it will
    // cancel this exact subscription anyway, so a second concurrent request
    // against it would be meaningless.
    modifiable: isActive && !pendingPlanChange,
    pendingPlanChange,
    events: sub.events.map((event) => ({
      id: event.id,
      type: event.type,
      amount: event.amount === null ? null : Number(event.amount),
      note: event.note,
      createdAt: event.createdAt,
    })),
  };
}

/**
 * Customer-initiated cancellation, distinct from Finance/Admin's own
 * subscription.service.ts actions (same underlying transition, different
 * caller) - the note makes clear to every internal role browsing the
 * Subscriptions list/company detail that the customer, not an approver,
 * ended this.
 */
export async function cancelMySubscription(subscriptionId: string, customerId: string, reason: string | undefined) {
  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) {
    throw ApiError.notFound("Subscription not found");
  }
  if (sub.customerId !== customerId) {
    throw ApiError.forbidden("You can only cancel your own subscriptions");
  }

  await cancelSubscription(subscriptionId, reason ? `Cancelled by customer: ${reason}` : "Cancelled by customer");

  return getMySubscriptionDetail(subscriptionId, customerId);
}

export async function listMyInvoices(customerId: string) {
  const invoices = await prisma.invoice.findMany({
    where: { customerId },
    include: { quote: true, subscription: { include: { product: true } } },
    orderBy: { dueDate: "asc" },
  });

  const format = (invoice: (typeof invoices)[number]) => ({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    amount: Number(invoice.amount),
    dueDate: invoice.dueDate,
    reference: invoice.quote?.quoteNumber ?? invoice.subscription?.product.name ?? "-",
  });

  return {
    paid: invoices.filter((invoice) => invoice.status === InvoiceStatus.PAID).map(format),
    unpaid: invoices.filter((invoice) => invoice.status === InvoiceStatus.UNPAID).map(format),
  };
}

export async function createMyRequest(customerId: string, input: CreateMyRequestInput) {
  const productIds = [...new Set(input.items.map((item) => item.productId))];
  const products = await prisma.product.findMany({ where: { id: { in: productIds }, active: true } });
  if (products.length !== productIds.length) {
    throw ApiError.badRequest("One or more selected products are unavailable");
  }

  // A "Change Subscription Plan" request: the product/quantity are forced
  // to match the subscription being modified exactly (this is a billing-
  // cycle change, not a chance to also sneak in a quantity/product change),
  // only the billing cycle may actually differ, the subscription must be
  // this customer's own and currently ACTIVE, and only one such request can
  // be in flight against it at a time.
  if (input.modifiesSubscriptionId) {
    const sub = await prisma.subscription.findUnique({ where: { id: input.modifiesSubscriptionId } });
    if (!sub || sub.customerId !== customerId) {
      throw ApiError.badRequest("Subscription not found");
    }
    if (sub.status !== SubscriptionStatus.ACTIVE) {
      throw ApiError.badRequest("Only an active subscription's plan can be changed");
    }
    if (input.items.length !== 1 || input.items[0].productId !== sub.productId || input.items[0].quantity !== sub.quantity) {
      throw ApiError.badRequest("A plan change keeps the same product and quantity - only the billing cycle can change");
    }
    if (!input.isRecurring || !input.billingCycle || input.billingCycle === sub.billingCycle) {
      throw ApiError.badRequest("Choose a different billing cycle than the subscription's current one");
    }
    if (await hasPendingPlanChange(input.modifiesSubscriptionId)) {
      throw ApiError.badRequest("A plan change for this subscription is already in progress");
    }
  }

  const request = await prisma.customerRequest.create({
    data: {
      customerId,
      notes: input.notes,
      expectedDiscountPercentage:
        input.expectedDiscountPercentage !== undefined
          ? new Prisma.Decimal(input.expectedDiscountPercentage)
          : undefined,
      isRecurring: input.isRecurring ?? false,
      billingCycle: input.isRecurring ? input.billingCycle : undefined,
      modifiesSubscriptionId: input.modifiesSubscriptionId,
      shippingLocation: input.shippingLocation,
      items: {
        create: input.items.map((item) => ({
          productId: item.productId,
          requestedQuantity: item.quantity,
        })),
      },
    },
    include: { items: { include: { product: true } } },
  });

  // Never pass Product.cost through to the customer, even though the
  // Prisma create's include fetched it.
  return {
    id: request.id,
    status: request.status,
    notes: request.notes,
    expectedDiscountPercentage: toNumber(request.expectedDiscountPercentage),
    isRecurring: request.isRecurring,
    billingCycle: request.billingCycle,
    shippingLocation: request.shippingLocation,
    createdAt: request.createdAt,
    items: request.items.map((item) => ({
      productName: item.product.name,
      quantity: item.requestedQuantity,
    })),
  };
}

// The two triggers described for the Negotiations tab: a quote that made it
// all the way to APPROVED but the customer wants a bigger discount, or one
// REJECTED at any approval level (Manager/Finance/Admin - the audit trail
// records which, but the customer-facing status is just REJECTED either
// way). Negotiating moves a quote to REVISION_REQUIRED - it stays visible
// here (as IN_PROGRESS, see below) rather than disappearing, so the
// customer can see their request went through, but can't negotiate again
// until the Sales Rep resubmits and it comes back around to APPROVED or
// REJECTED.
const ACTIONABLE_STATUSES: QuoteStatus[] = [QuoteStatus.APPROVED, QuoteStatus.REJECTED];

const NEGOTIABLE_QUOTE_INCLUDE = {
  items: { include: { product: true } },
  auditEntries: { orderBy: { createdAt: "desc" as const }, take: 1 },
} satisfies Prisma.QuoteInclude;

type NegotiableQuote = Prisma.QuoteGetPayload<{ include: typeof NEGOTIABLE_QUOTE_INCLUDE }>;

// Customer-safe view of a quote: no riskLevel, no full audit trail, no cost
// - none of the internal approval reasoning belongs in the customer portal,
// except the rejection reason itself, which is legitimate business
// communication the customer needs to see.
function formatNegotiableQuote(quote: NegotiableQuote) {
  const latestEntry = quote.auditEntries[0];
  const negotiationStatus: "NEGOTIABLE" | "IN_PROGRESS" =
    quote.status === QuoteStatus.REVISION_REQUIRED ? "IN_PROGRESS" : "NEGOTIABLE";

  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    status: quote.status,
    negotiationStatus,
    rejectionReason:
      quote.status === QuoteStatus.REJECTED ? latestEntry?.note ?? null : null,
    subtotal: Number(quote.subtotal),
    discountPercentage: Number(quote.discountPercentage),
    taxPercentage: Number(quote.taxPercentage),
    totalAmount: Number(quote.totalAmount),
    items: quote.items.map((item) => ({
      productName: item.product.name,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal),
    })),
    updatedAt: quote.updatedAt,
  };
}

export async function listMyNegotiableQuotes(customerId: string) {
  const quotes = await prisma.quote.findMany({
    where: {
      customerId,
      status: { in: [...ACTIONABLE_STATUSES, QuoteStatus.REVISION_REQUIRED] },
    },
    include: NEGOTIABLE_QUOTE_INCLUDE,
    orderBy: { updatedAt: "desc" },
  });

  // A REVISION_REQUIRED quote only belongs here if a customer negotiation
  // put it there - one an approver returned for revision is an internal
  // matter the customer never triggered and shouldn't see reappear.
  return quotes
    .filter(
      (quote) =>
        quote.status !== QuoteStatus.REVISION_REQUIRED ||
        quote.auditEntries[0]?.action === QuoteAuditAction.CUSTOMER_NEGOTIATION
    )
    .map(formatNegotiableQuote);
}

/**
 * Negotiating never re-enters the approval chain directly - it hands the
 * quote back to the Sales Rep (REVISION_REQUIRED, same mechanism an
 * approver's "return" uses) and, if it came from a CustomerRequest, flips
 * that request back to IN_REVIEW so it reappears in the Rep's active queue
 * ("it will go back in customer requests for sales_rep"). riskLevel is
 * cleared since it was computed for the pre-negotiation discount - the risk
 * engine re-runs fresh whenever the Rep resubmits.
 */
export async function negotiateQuote(
  quoteId: string,
  customerId: string,
  userId: string,
  input: NegotiateQuoteInput
) {
  const updated = await prisma.$transaction(async (tx) => {
    const quote = await tx.quote.findUnique({ where: { id: quoteId }, include: { items: true } });
    if (!quote) {
      throw ApiError.notFound("Quote not found");
    }
    if (quote.customerId !== customerId) {
      throw ApiError.forbidden("You can only negotiate your own quotes");
    }
    if (!ACTIONABLE_STATUSES.includes(quote.status)) {
      throw ApiError.badRequest("This quote is not available for negotiation");
    }

    const discountPercentage =
      input.requestedDiscountPercentage !== undefined
        ? new Prisma.Decimal(input.requestedDiscountPercentage)
        : quote.discountPercentage;
    const totals = calculateTotals(quote.items, discountPercentage, quote.taxPercentage);

    const result = await tx.quote.updateMany({
      where: { id: quoteId, status: quote.status },
      data: { status: QuoteStatus.REVISION_REQUIRED, riskLevel: null, ...totals },
    });
    if (result.count === 0) {
      throw ApiError.conflict("This quote just changed - please refresh and try again");
    }

    await tx.quoteAuditEntry.create({
      data: { quoteId, userId, action: QuoteAuditAction.CUSTOMER_NEGOTIATION, note: input.note },
    });

    if (quote.customerRequestId) {
      await tx.customerRequest.update({
        where: { id: quote.customerRequestId },
        data: { status: CustomerRequestStatus.IN_REVIEW },
      });
    }

    return tx.quote.findUnique({ where: { id: quoteId }, include: NEGOTIABLE_QUOTE_INCLUDE });
  });

  return formatNegotiableQuote(updated!);
}

async function loadRecommendationForCustomer(recommendationId: string, customerId: string) {
  const recommendation = await prisma.quoteRecommendation.findUnique({
    where: { id: recommendationId },
    include: { quote: { select: { customerId: true } } },
  });
  if (!recommendation) {
    throw ApiError.notFound("Recommendation not found");
  }
  if (recommendation.quote.customerId !== customerId) {
    throw ApiError.forbidden("You can only act on your own recommendations");
  }
  if (recommendation.status !== RecommendationStatus.SENT_TO_CUSTOMER) {
    throw ApiError.badRequest("This recommendation is no longer awaiting your response");
  }
  return recommendation;
}

/**
 * Accepting a recommendation works "just like a normal order" - it creates
 * a brand new CustomerRequest for the recommended product (customer picks
 * quantity/expected discount/comments the same way Create New Request
 * does), and marks the recommendation ACCEPTED. Both happen in one
 * transaction so a failure partway through never leaves the recommendation
 * marked accepted without the order actually existing.
 */
export async function acceptRecommendation(
  recommendationId: string,
  customerId: string,
  input: AcceptRecommendationInput
) {
  const recommendation = await loadRecommendationForCustomer(recommendationId, customerId);

  return prisma.$transaction(async (tx) => {
    const result = await tx.quoteRecommendation.updateMany({
      where: { id: recommendationId, status: RecommendationStatus.SENT_TO_CUSTOMER },
      data: { status: RecommendationStatus.ACCEPTED },
    });
    if (result.count === 0) {
      throw ApiError.conflict("This recommendation just changed - please refresh and try again");
    }

    const product = await tx.product.findUnique({ where: { id: recommendation.productId } });
    if (!product || !product.active) {
      throw ApiError.badRequest("This product is no longer available");
    }

    const request = await tx.customerRequest.create({
      data: {
        customerId,
        notes: input.notes,
        expectedDiscountPercentage:
          input.expectedDiscountPercentage !== undefined
            ? new Prisma.Decimal(input.expectedDiscountPercentage)
            : undefined,
        items: { create: [{ productId: recommendation.productId, requestedQuantity: input.quantity }] },
      },
      include: { items: { include: { product: true } } },
    });

    return {
      id: request.id,
      status: request.status,
      notes: request.notes,
      expectedDiscountPercentage: toNumber(request.expectedDiscountPercentage),
      createdAt: request.createdAt,
      items: request.items.map((item) => ({
        productName: item.product.name,
        quantity: item.requestedQuantity,
      })),
    };
  });
}

// Reflects back to the Sales Rep by simply leaving the recommendation in
// DECLINED status - the Quote Builder's recommendations panel already shows
// per-recommendation status, so the Rep sees it there without needing any
// separate notification channel.
export async function declineRecommendation(recommendationId: string, customerId: string) {
  await loadRecommendationForCustomer(recommendationId, customerId);

  const result = await prisma.quoteRecommendation.updateMany({
    where: { id: recommendationId, status: RecommendationStatus.SENT_TO_CUSTOMER },
    data: { status: RecommendationStatus.DECLINED },
  });
  if (result.count === 0) {
    throw ApiError.conflict("This recommendation just changed - please refresh and try again");
  }
}

function formatDiscountReview(request: {
  id: string;
  expectedDiscountPercentage: Prisma.Decimal | null;
  proposedDiscountPercentage: Prisma.Decimal | null;
  createdAt: Date;
  items: { requestedQuantity: number; product: { name: string } }[];
}) {
  return {
    id: request.id,
    items: request.items.map((item) => ({ productName: item.product.name, quantity: item.requestedQuantity })),
    expectedDiscountPercentage: toNumber(request.expectedDiscountPercentage),
    proposedDiscountPercentage: toNumber(request.proposedDiscountPercentage),
    createdAt: request.createdAt,
  };
}

// Every order where the Sales Rep's offered discount fell short of what the
// customer asked for (see quote.service.ts's submitQuote gate) - shown on
// the portal's Negotiations tab until the customer resolves it below.
export async function listMyDiscountReviews(customerId: string) {
  const requests = await prisma.customerRequest.findMany({
    where: { customerId, discountReviewStatus: DiscountReviewStatus.PENDING },
    include: { items: { include: { product: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return requests.map(formatDiscountReview);
}

/**
 * Resolves a discount shortfall - the customer either accepts the Rep's
 * lower offer (newExpectedDiscountPercentage = the proposed value) or
 * counters with a different ask. Either way this just updates
 * expectedDiscountPercentage and clears the pending flag; the Rep's next
 * submit attempt re-checks against whatever value lands here.
 */
export async function resolveDiscountReview(
  requestId: string,
  customerId: string,
  newExpectedDiscountPercentage: number,
  note: string | undefined
) {
  const request = await prisma.customerRequest.findUnique({ where: { id: requestId } });
  if (!request) {
    throw ApiError.notFound("Order not found");
  }
  if (request.customerId !== customerId) {
    throw ApiError.forbidden("You can only resolve your own orders");
  }
  if (request.discountReviewStatus !== DiscountReviewStatus.PENDING) {
    throw ApiError.badRequest("There is no discount review pending for this order");
  }

  const result = await prisma.customerRequest.updateMany({
    where: { id: requestId, discountReviewStatus: DiscountReviewStatus.PENDING },
    data: {
      expectedDiscountPercentage: new Prisma.Decimal(newExpectedDiscountPercentage),
      proposedDiscountPercentage: null,
      discountReviewStatus: DiscountReviewStatus.NONE,
      notes: note ? `${request.notes ? `${request.notes} | ` : ""}${note}` : request.notes,
    },
  });
  if (result.count === 0) {
    throw ApiError.conflict("This order just changed - please refresh and try again");
  }

  return listMyDiscountReviews(customerId);
}
