import {
  BillingCycle,
  CustomerRequestStatus,
  DiscountReviewStatus,
  Prisma,
  QuoteAuditAction,
  QuoteStatus,
  Role,
} from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";
import { assessDiscountRisk, getDiscountGovernanceContext } from "./discountGovernance.service";
import {
  releaseAllocationsForItems,
  releaseAllocationsForQuote,
  reserveAllocationsForItem,
} from "./inventory.service";
import { computeMarginPercent, type PriorityRequesterContext } from "./stockPriority.service";
import type { CreateQuoteInput, QuoteItemInput, UpdateQuoteInput } from "../validation/quote.validation";

// A quote is editable/re-submittable by its Sales Rep only while it's a
// draft or has just been kicked back for revision by an approver.
const EDITABLE_STATUSES: QuoteStatus[] = [QuoteStatus.DRAFT, QuoteStatus.REVISION_REQUIRED];

interface AuthenticatedUser {
  id: string;
  role: Role;
}

const QUOTE_INCLUDE = {
  customer: true,
  items: { include: { product: true, allocations: { include: { warehouse: true } } } },
  // Lets the Sales Rep see what the customer actually expects, and whether
  // their own last submit attempt got flagged for falling short of it (see
  // submitQuote's discount-expectation gate below).
  customerRequest: {
    select: {
      expectedDiscountPercentage: true,
      proposedDiscountPercentage: true,
      discountReviewStatus: true,
    },
  },
  // Most recent Deal-Health "Nudge Sales Rep" reminder, if any -
  // sanitizeQuote.ts decides whether it's still "unread" (newer than this
  // quote's own updatedAt) before surfacing it.
  auditEntries: {
    where: { action: QuoteAuditAction.NUDGED },
    orderBy: { createdAt: "desc" as const },
    take: 1,
    include: { user: true },
  },
} satisfies Prisma.QuoteInclude;

/**
 * Reserves warehouse stock for each just-created QuoteItem, matching each
 * one back to the source input by productId to find its (optional)
 * client-supplied warehouse split. Must run inside the same transaction
 * that created the items.
 */
async function reserveForItems(
  tx: Prisma.TransactionClient,
  createdItems: { id: string; productId: string; quantity: number }[],
  sourceItems: QuoteItemInput[],
  requester: PriorityRequesterContext,
  shippingLocation?: string | null
) {
  const bySourceProductId = new Map(sourceItems.map((item) => [item.productId, item]));
  for (const item of createdItems) {
    const source = bySourceProductId.get(item.productId);
    await reserveAllocationsForItem(
      tx,
      item.id,
      item.productId,
      item.quantity,
      source?.allocations,
      requester,
      shippingLocation ?? undefined
    );
  }
}

interface ResolvedLineItem {
  productId: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  cost: Prisma.Decimal;
}

/**
 * Looks up each requested product and snapshots its CURRENT selling price.
 * This snapshot (QuoteItem.unitPrice) is what gets persisted - later changes
 * to Product.unitPrice must never retroactively affect an existing quote.
 */
async function resolveLineItems(
  tx: Prisma.TransactionClient,
  requestedItems: { productId: string; quantity: number }[]
): Promise<ResolvedLineItem[]> {
  if (requestedItems.length === 0) return [];

  const productIds = [...new Set(requestedItems.map((item) => item.productId))];
  const products = await tx.product.findMany({ where: { id: { in: productIds } } });
  const productMap = new Map(products.map((product) => [product.id, product]));

  return requestedItems.map((item) => {
    const product = productMap.get(item.productId);
    if (!product || !product.active) {
      throw ApiError.badRequest(`Product not found or inactive: ${item.productId}`);
    }
    return {
      productId: product.id,
      quantity: item.quantity,
      unitPrice: product.unitPrice,
      cost: product.cost,
    };
  });
}

function toQuoteItemsCreateData(items: ResolvedLineItem[]) {
  return items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.unitPrice.mul(item.quantity),
  }));
}

/**
 * Backend-authoritative totals. Never trust subtotal/discount/tax/total
 * values sent by the client - only the raw percentages are accepted as
 * input, and even those are always re-applied to a freshly computed
 * subtotal here.
 *
 * subtotal = sum(quantity * unitPrice)
 * discountAmount = subtotal * discountPercentage / 100
 * taxableAmount = subtotal - discountAmount
 * taxAmount = taxableAmount * taxPercentage / 100
 * totalAmount = taxableAmount + taxAmount
 */
export function calculateTotals(
  items: { unitPrice: Prisma.Decimal; quantity: number }[],
  discountPercentage: Prisma.Decimal,
  taxPercentage: Prisma.Decimal
) {
  const subtotal = items.reduce(
    (sum, item) => sum.add(item.unitPrice.mul(item.quantity)),
    new Prisma.Decimal(0)
  );
  const discountAmount = subtotal.mul(discountPercentage).div(100);
  const taxableAmount = subtotal.sub(discountAmount);
  const taxAmount = taxableAmount.mul(taxPercentage).div(100);
  const totalAmount = taxableAmount.add(taxAmount);
  return { subtotal, discountPercentage, taxPercentage, discountAmount, taxAmount, totalAmount };
}

async function generateQuoteNumber(tx: Prisma.TransactionClient): Promise<string> {
  const count = await tx.quote.count();
  return `QT-${String(count + 1).padStart(5, "0")}`;
}

// SALES_REP sees only their own quotes; MANAGER sees every quote (read-only
// oversight - "same screen" as the Sales Rep's Quotations page).
export async function listQuotes(user: AuthenticatedUser) {
  const where: Prisma.QuoteWhereInput = user.role === Role.SALES_REP ? { salesRepId: user.id } : {};
  return prisma.quote.findMany({
    where,
    include: QUOTE_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

export async function getQuoteForUser(quoteId: string, user: AuthenticatedUser) {
  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, include: QUOTE_INCLUDE });
  if (!quote) {
    throw ApiError.notFound("Quote not found");
  }
  if (user.role === Role.SALES_REP && quote.salesRepId !== user.id) {
    throw ApiError.forbidden("You can only view your own quotes");
  }
  return quote;
}

export async function createQuote(input: CreateQuoteInput, salesRepId: string) {
  return prisma.$transaction(async (tx) => {
    let customerId = input.customerId;
    let requestItems: { productId: string; quantity: number }[] = [];
    let customerRequest: {
      id: string;
      customerId: string;
      isRecurring: boolean;
      billingCycle: BillingCycle | null;
      shippingLocation: string | null;
    } | null = null;

    if (input.customerRequestId) {
      const request = await tx.customerRequest.findUnique({
        where: { id: input.customerRequestId },
        include: { items: true, quote: true },
      });
      if (!request) {
        throw ApiError.badRequest("Customer request not found");
      }

      // A request converts into at most one quotation. If one already
      // exists (draft or submitted), return it instead of creating a
      // duplicate - this also covers the CONVERTED case, since a converted
      // request always has a linked quote by construction.
      if (request.quote) {
        const existingQuote = await tx.quote.findUnique({
          where: { id: request.quote.id },
          include: QUOTE_INCLUDE,
        });
        return { quote: existingQuote!, created: false };
      }

      if (request.status === CustomerRequestStatus.CANCELLED) {
        throw ApiError.badRequest("Cannot create a quote from a cancelled request");
      }

      customerRequest = request;
      customerId = request.customerId;
      requestItems = request.items.map((item) => ({
        productId: item.productId,
        quantity: item.requestedQuantity,
      }));
    }

    if (!customerId) {
      throw ApiError.badRequest("customerId is required");
    }

    const customer = await tx.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      throw ApiError.badRequest("Customer not found");
    }

    // A request-based quote's composition is fixed by what the customer
    // actually asked for - input.items is only honored when there's no
    // customerRequest to derive it from, never as an override of one.
    const sourceItems: QuoteItemInput[] = customerRequest
      ? requestItems
      : input.items ?? [];
    const resolvedItems = await resolveLineItems(tx, sourceItems);
    const discountPercentage = new Prisma.Decimal(input.discountPercentage ?? 0);
    const taxPercentage = new Prisma.Decimal(input.taxPercentage ?? 0);
    const totals = calculateTotals(resolvedItems, discountPercentage, taxPercentage);
    const quoteNumber = await generateQuoteNumber(tx);

    const quote = await tx.quote.create({
      data: {
        quoteNumber,
        customerId,
        salesRepId,
        customerRequestId: customerRequest?.id,
        notes: input.notes,
        isRecurring: customerRequest?.isRecurring ?? false,
        billingCycle: customerRequest?.billingCycle,
        shippingLocation: customerRequest?.shippingLocation ?? input.shippingLocation,
        ...totals,
        items: { create: toQuoteItemsCreateData(resolvedItems) },
      },
      include: QUOTE_INCLUDE,
    });

    // Reserving immediately on creation - not deferred until submit/approval
    // - is deliberate: the moment a quote exists with real quantities, that
    // stock is spoken for, so Fulfillment reflects it for every role right
    // away rather than only once the quote is later approved.
    const requester: PriorityRequesterContext = {
      customerName: customer.name,
      tier: customer.tier,
      marginPercent: computeMarginPercent(resolvedItems, discountPercentage),
    };
    await reserveForItems(tx, quote.items, sourceItems, requester, customerRequest?.shippingLocation);

    if (customerRequest) {
      await tx.customerRequest.update({
        where: { id: customerRequest.id },
        data: { status: CustomerRequestStatus.QUOTED },
      });
    }

    const withAllocations = await tx.quote.findUniqueOrThrow({ where: { id: quote.id }, include: QUOTE_INCLUDE });
    return { quote: withAllocations, created: true };
  });
}

export async function updateQuote(
  quoteId: string,
  input: UpdateQuoteInput,
  user: AuthenticatedUser
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.quote.findUnique({
      where: { id: quoteId },
      include: { items: true, customer: true, customerRequest: { include: { items: true } } },
    });
    if (!existing) {
      throw ApiError.notFound("Quote not found");
    }
    if (existing.salesRepId !== user.id) {
      throw ApiError.forbidden("You can only edit your own quotes");
    }
    if (!EDITABLE_STATUSES.includes(existing.status)) {
      throw ApiError.badRequest("Only draft or revision-required quotes can be edited");
    }

    // A quote built from a customer request never trusts the client for
    // what's on it or how much - the request's own items are authoritative,
    // and only that request's products can carry a warehouse-allocation
    // choice through. This makes the "quantity is fixed" rule a backend
    // guarantee, not just a frontend restriction that a direct API call
    // could bypass.
    const sourceItems: QuoteItemInput[] = existing.customerRequest
      ? existing.customerRequest.items.map((requestItem) => {
          const clientAllocations = input.items.find(
            (item) => item.productId === requestItem.productId
          )?.allocations;
          return {
            productId: requestItem.productId,
            quantity: requestItem.requestedQuantity,
            allocations: clientAllocations,
          };
        })
      : input.items;

    const resolvedItems = await resolveLineItems(tx, sourceItems);
    const discountPercentage = new Prisma.Decimal(
      input.discountPercentage ?? existing.discountPercentage
    );
    const taxPercentage = new Prisma.Decimal(input.taxPercentage ?? existing.taxPercentage);
    const totals = calculateTotals(resolvedItems, discountPercentage, taxPercentage);
    // A request-based quote's shipping location is fixed by the request that
    // created it, same reasoning as sourceItems above - only a manually
    // started quote (no customerRequest) lets the Sales Rep set/edit it here.
    const shippingLocation = existing.customerRequest
      ? existing.shippingLocation
      : input.shippingLocation ?? existing.shippingLocation;

    // Release whatever this quote currently has reserved BEFORE the items
    // are replaced - reads the still-live allocation rows, then the
    // deleteMany below cascades them away along with the old items.
    await releaseAllocationsForItems(
      tx,
      existing.items.map((item) => item.id)
    );
    await tx.quoteItem.deleteMany({ where: { quoteId } });

    const updated = await tx.quote.update({
      where: { id: quoteId },
      data: {
        notes: input.notes,
        shippingLocation,
        ...totals,
        items: { create: toQuoteItemsCreateData(resolvedItems) },
      },
      include: QUOTE_INCLUDE,
    });

    const requester: PriorityRequesterContext = {
      customerName: existing.customer.name,
      tier: existing.customer.tier,
      marginPercent: computeMarginPercent(resolvedItems, discountPercentage),
    };
    await reserveForItems(tx, updated.items, sourceItems, requester, shippingLocation);

    return tx.quote.findUniqueOrThrow({ where: { id: quoteId }, include: QUOTE_INCLUDE });
  });
}

export async function submitQuote(quoteId: string, user: AuthenticatedUser) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.quote.findUnique({
      where: { id: quoteId },
      include: { items: { include: { product: true } }, customer: true, customerRequest: true },
    });
    if (!existing) {
      throw ApiError.notFound("Quote not found");
    }
    if (existing.salesRepId !== user.id) {
      throw ApiError.forbidden("You can only submit your own quotes");
    }
    if (!EDITABLE_STATUSES.includes(existing.status)) {
      throw ApiError.badRequest("Only draft or revision-required quotes can be submitted");
    }
    if (existing.items.length === 0) {
      throw ApiError.badRequest("Cannot submit a quote with no items");
    }

    // Discount-expectation gate: the Rep can't send a lower discount than
    // the customer asked for straight to Manager/Finance approval - it's
    // flagged for the customer to resolve first (portal's Negotiations
    // tab), and the quote stays in its current editable status (not
    // submitted) until they do. See customerPortal.service.ts's
    // resolveDiscountReview for the other half of this.
    if (existing.customerRequest) {
      const expected = existing.customerRequest.expectedDiscountPercentage;
      if (expected != null && existing.discountPercentage.lessThan(expected)) {
        await tx.customerRequest.update({
          where: { id: existing.customerRequest.id },
          data: {
            proposedDiscountPercentage: existing.discountPercentage,
            discountReviewStatus: DiscountReviewStatus.PENDING,
          },
        });
        return tx.quote.findUniqueOrThrow({ where: { id: quoteId }, include: QUOTE_INCLUDE });
      }
      // The Rep's discount now meets/exceeds what the customer asked for -
      // clear any stale flag from an earlier, lower attempt so it doesn't
      // linger unresolved in the customer's Negotiations tab.
      if (existing.customerRequest.discountReviewStatus === DiscountReviewStatus.PENDING) {
        await tx.customerRequest.update({
          where: { id: existing.customerRequest.id },
          data: { discountReviewStatus: DiscountReviewStatus.NONE, proposedDiscountPercentage: null },
        });
      }
    }

    const totals = calculateTotals(
      existing.items.map((item) => ({ unitPrice: item.unitPrice, quantity: item.quantity })),
      existing.discountPercentage,
      existing.taxPercentage
    );

    // Discount-governance risk engine decides risk level, but every quote -
    // regardless of risk - goes to the Sales Manager first. Finance only
    // gets involved for HIGH risk, once the Manager has signed off (see
    // approval.service.ts's approve transition), and every path still ends
    // at Admin since no quote is confirmed without Admin's master sign-off.
    const governanceContext = await getDiscountGovernanceContext(tx, existing.customer.tier);
    const { riskLevel } = assessDiscountRisk(existing.items, totals.discountPercentage, governanceContext);

    const nextStatus = QuoteStatus.PENDING_MANAGER_APPROVAL;

    const isResubmission = existing.status === QuoteStatus.REVISION_REQUIRED;

    const quote = await tx.quote.update({
      where: { id: quoteId },
      data: { status: nextStatus, riskLevel, ...totals },
      include: QUOTE_INCLUDE,
    });

    await tx.quoteAuditEntry.create({
      data: {
        quoteId,
        userId: user.id,
        action: isResubmission ? QuoteAuditAction.RESUBMITTED : QuoteAuditAction.SUBMITTED,
        note: `Applied ${totals.discountPercentage}% discount, ${totals.taxPercentage}% tax`,
      },
    });

    // Customer-request → quotation lifecycle: submitting the quote is what
    // takes the originating request out of the active queue for good.
    if (existing.customerRequestId) {
      await tx.customerRequest.update({
        where: { id: existing.customerRequestId },
        data: { status: CustomerRequestStatus.CONVERTED },
      });
    }

    return quote;
  });
}

/**
 * A pre-submission bail-out: the Sales Rep found the requested quantity
 * exceeds available inventory and is telling the customer up front that the
 * order can't be fulfilled as quoted. Reuses the REJECTED status - this
 * quote then surfaces via the customer's Negotiations tab exactly like an
 * approver's rejection would (with this note as the rejection reason),
 * letting the customer negotiate down the quantity through the same
 * existing flow rather than needing a separate mechanism.
 */
export async function markStockUnavailable(quoteId: string, user: AuthenticatedUser, note: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.quote.findUnique({ where: { id: quoteId } });
    if (!existing) {
      throw ApiError.notFound("Quote not found");
    }
    if (existing.salesRepId !== user.id) {
      throw ApiError.forbidden("You can only manage your own quotes");
    }
    if (!EDITABLE_STATUSES.includes(existing.status)) {
      throw ApiError.badRequest("Only draft or revision-required quotes can be marked as not possible");
    }

    const result = await tx.quote.updateMany({
      where: { id: quoteId, status: existing.status },
      data: { status: QuoteStatus.REJECTED },
    });
    if (result.count === 0) {
      throw ApiError.conflict("This quote just changed - please refresh and try again");
    }

    await tx.quoteAuditEntry.create({
      data: { quoteId, userId: user.id, action: QuoteAuditAction.STOCK_UNAVAILABLE, note },
    });

    // The order won't be fulfilled from this reservation - free the stock
    // back up for other orders.
    await releaseAllocationsForQuote(tx, quoteId);

    return tx.quote.findUniqueOrThrow({ where: { id: quoteId }, include: QUOTE_INCLUDE });
  });
}

/**
 * Permanently removes a draft the Sales Rep never submitted. Only DRAFT
 * (never REVISION_REQUIRED - that status carries a real approver/customer
 * history worth keeping, and the Rep is expected to revise and resubmit it,
 * not discard it). If it came from a CustomerRequest, that request flips
 * back to IN_REVIEW - same mechanism a customer negotiation uses - so it
 * reappears in the Rep's active queue instead of staying stuck on a quote
 * that no longer exists.
 */
export async function deleteQuoteDraft(quoteId: string, user: AuthenticatedUser) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.quote.findUnique({ where: { id: quoteId } });
    if (!existing) {
      throw ApiError.notFound("Quote not found");
    }
    if (existing.salesRepId !== user.id) {
      throw ApiError.forbidden("You can only delete your own quotes");
    }
    if (existing.status !== QuoteStatus.DRAFT) {
      throw ApiError.badRequest("Only draft quotes can be deleted");
    }

    // Release reservations before the cascade delete below removes the
    // allocation rows out from under it.
    await releaseAllocationsForQuote(tx, quoteId);

    const result = await tx.quote.deleteMany({ where: { id: quoteId, status: existing.status } });
    if (result.count === 0) {
      throw ApiError.conflict("This quote just changed - please refresh and try again");
    }

    if (existing.customerRequestId) {
      await tx.customerRequest.update({
        where: { id: existing.customerRequestId },
        data: { status: CustomerRequestStatus.IN_REVIEW },
      });
    }
  });
}
