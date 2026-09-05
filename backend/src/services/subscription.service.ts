import {
  BillingCycle,
  Prisma,
  ProductCategory,
  SubscriptionEventType,
  SubscriptionStatus,
} from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";
import { addBillingCycleInterval, cycleLengthInDays } from "../utils/billingCycle";

/**
 * Called once a quote reaches APPROVED - from the auto-approve path in
 * quote.service.ts (LOW risk) or the final Finance approval in
 * approval.service.ts (MEDIUM/HIGH risk). Creates one Subscription per
 * SUBSCRIPTION-category line item. Idempotent: safe to call more than once
 * for the same quote.
 *
 * There's no per-line billing-cycle picker in the Quote Builder yet, so
 * MONTHLY is the default until that's added.
 */
export async function createSubscriptionsForApprovedQuote(
  tx: Prisma.TransactionClient,
  quoteId: string
) {
  const quote = await tx.quote.findUnique({
    where: { id: quoteId },
    include: { items: { include: { product: true } } },
  });
  if (!quote) return;

  const subscriptionItems = quote.items.filter(
    (item) => item.product.category === ProductCategory.SUBSCRIPTION
  );

  for (const item of subscriptionItems) {
    const existing = await tx.subscription.findFirst({
      where: { quoteId: quote.id, productId: item.productId },
    });
    if (existing) continue;

    const billingCycle = BillingCycle.MONTHLY;
    const nextBillingDate = addBillingCycleInterval(new Date(), billingCycle);

    const subscription = await tx.subscription.create({
      data: {
        customerId: quote.customerId,
        productId: item.productId,
        quoteId: quote.id,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        billingCycle,
        nextBillingDate,
      },
    });

    await tx.subscriptionEvent.create({
      data: {
        subscriptionId: subscription.id,
        type: SubscriptionEventType.CREATED,
        amount: item.lineTotal,
        note: `Subscription created from quote ${quote.quoteNumber}`,
      },
    });
  }
}

const LIST_INCLUDE = { customer: true, product: true } satisfies Prisma.SubscriptionInclude;
type SubscriptionListRow = Prisma.SubscriptionGetPayload<{ include: typeof LIST_INCLUDE }>;

function formatSubscriptionListItem(sub: SubscriptionListRow) {
  return {
    id: sub.id,
    customer: { id: sub.customer.id, name: sub.customer.name, tier: sub.customer.tier },
    product: { id: sub.product.id, name: sub.product.name, sku: sub.product.sku },
    quantity: sub.quantity,
    unitPrice: Number(sub.unitPrice),
    billingCycle: sub.billingCycle,
    status: sub.status,
    nextBillingDate: sub.nextBillingDate,
    startDate: sub.startDate,
  };
}

export async function listSubscriptions() {
  const subs = await prisma.subscription.findMany({
    include: LIST_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  const summary = {
    active: subs.filter((s) => s.status === SubscriptionStatus.ACTIVE).length,
    paused: subs.filter((s) => s.status === SubscriptionStatus.PAUSED).length,
    cancelled: subs.filter((s) => s.status === SubscriptionStatus.CANCELLED).length,
  };

  return { summary, items: subs.map(formatSubscriptionListItem) };
}

export async function getCompanySubscriptionDetail(customerId: string) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    throw ApiError.notFound("Customer not found");
  }

  const subscriptions = await prisma.subscription.findMany({
    where: { customerId },
    include: { customer: true, product: true, events: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });

  const approvedQuotes = await prisma.quote.findMany({
    where: { customerId, status: "APPROVED" },
    include: { items: { include: { product: true } } },
    orderBy: { updatedAt: "desc" },
  });

  const oneTimeOrders = approvedQuotes
    .map((quote) => {
      const oneTimeItems = quote.items.filter(
        (item) => item.product.category !== ProductCategory.SUBSCRIPTION
      );
      const amount = oneTimeItems.reduce(
        (sum, item) => sum.add(item.lineTotal),
        new Prisma.Decimal(0)
      );
      return {
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        date: quote.updatedAt,
        products: oneTimeItems.map((item) => item.product.name).join(", "),
        amount: Number(amount),
      };
    })
    .filter((order) => order.amount > 0);

  const recurringOrders = subscriptions
    .flatMap((sub) =>
      sub.events.map((event) => ({
        id: event.id,
        subscriptionId: sub.id,
        productName: sub.product.name,
        billingCycle: sub.billingCycle,
        type: event.type,
        amount: event.amount === null ? null : Number(event.amount),
        note: event.note,
        createdAt: event.createdAt,
      }))
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return {
    customer: { id: customer.id, name: customer.name, tier: customer.tier },
    subscriptions: subscriptions.map(formatSubscriptionListItem),
    oneTimeOrders,
    recurringOrders,
  };
}

/**
 * Guards the status transition with a conditional update (status must still
 * match what was just read), same race-safety pattern used for approvals:
 * a concurrent action on the same subscription gets detected and rejected
 * rather than silently double-applied.
 */
async function transitionSubscription(
  subscriptionId: string,
  allowedFrom: SubscriptionStatus[],
  toStatus: SubscriptionStatus,
  eventType: SubscriptionEventType,
  note: string | undefined
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) {
      throw ApiError.notFound("Subscription not found");
    }
    if (!allowedFrom.includes(sub.status)) {
      throw ApiError.badRequest(`Cannot perform this action while the subscription is ${sub.status}`);
    }

    const result = await tx.subscription.updateMany({
      where: { id: subscriptionId, status: sub.status },
      data: { status: toStatus },
    });
    if (result.count === 0) {
      throw ApiError.conflict("This subscription's status just changed - please refresh and try again");
    }

    await tx.subscriptionEvent.create({
      data: { subscriptionId, type: eventType, note: note ?? null },
    });

    return sub.customerId;
  });
}

export async function pauseSubscription(id: string, note?: string) {
  return transitionSubscription(
    id,
    [SubscriptionStatus.ACTIVE],
    SubscriptionStatus.PAUSED,
    SubscriptionEventType.PAUSED,
    note
  );
}

export async function resumeSubscription(id: string, note?: string) {
  return transitionSubscription(
    id,
    [SubscriptionStatus.PAUSED],
    SubscriptionStatus.ACTIVE,
    SubscriptionEventType.RESUMED,
    note
  );
}

export async function cancelSubscription(id: string, note?: string) {
  return transitionSubscription(
    id,
    [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAUSED],
    SubscriptionStatus.CANCELLED,
    SubscriptionEventType.CANCELLED,
    note
  );
}

/**
 * Prorates a mid-cycle quantity change: charge/credit = unitPrice *
 * quantityDelta * (daysRemainingInCycle / cycleLengthInDays). Positive
 * amount = charge, negative = credit. This is the one action that produces
 * a genuine "proration" entry in the recurring-orders history.
 */
export async function changeSubscriptionQuantity(id: string, newQuantity: number): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.findUnique({ where: { id } });
    if (!sub) {
      throw ApiError.notFound("Subscription not found");
    }
    if (sub.status !== SubscriptionStatus.ACTIVE) {
      throw ApiError.badRequest("Only active subscriptions can have their quantity changed");
    }
    if (newQuantity === sub.quantity) {
      throw ApiError.badRequest("New quantity must be different from the current quantity");
    }

    const cycleDays = cycleLengthInDays(sub.billingCycle);
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysRemaining = Math.max(
      0,
      Math.min(cycleDays, Math.round((sub.nextBillingDate.getTime() - Date.now()) / msPerDay))
    );
    const quantityDelta = newQuantity - sub.quantity;
    const prorationAmount = sub.unitPrice.mul(quantityDelta).mul(daysRemaining).div(cycleDays);

    const result = await tx.subscription.updateMany({
      where: { id, status: SubscriptionStatus.ACTIVE, quantity: sub.quantity },
      data: { quantity: newQuantity },
    });
    if (result.count === 0) {
      throw ApiError.conflict("This subscription just changed - please refresh and try again");
    }

    const direction = quantityDelta > 0 ? "increased" : "decreased";
    const impact = prorationAmount.isNegative() ? "credit" : "charge";
    await tx.subscriptionEvent.create({
      data: {
        subscriptionId: id,
        type: SubscriptionEventType.QUANTITY_CHANGED,
        amount: prorationAmount,
        note: `Quantity ${direction} from ${sub.quantity} to ${newQuantity} (${daysRemaining}/${cycleDays} days left in cycle) - ${impact} of ${prorationAmount.abs()}`,
      },
    });

    return sub.customerId;
  });
}
