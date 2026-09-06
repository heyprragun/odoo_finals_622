import { CustomerTier, Prisma, QuoteStatus, StockPriorityConflictStatus } from "@prisma/client";
import { prisma } from "../config/prisma";

// GOLD outranks SILVER outranks BRONZE - matches how every other tier-driven
// policy in this app (discount governance tier limits, the tier order shown
// on Discount Settings) already treats the enum's declared order.
const TIER_RANK: Record<CustomerTier, number> = {
  [CustomerTier.GOLD]: 0,
  [CustomerTier.SILVER]: 1,
  [CustomerTier.BRONZE]: 2,
};

// A quote in one of these statuses still holds a live reservation. APPROVED
// is deliberately excluded - a confirmed order's stock is never up for
// reallocation, no matter who else needs it - and REJECTED/CANCELLED already
// released theirs via releaseAllocationsForQuote, so they'd never show up as
// a blocker anyway.
export const BLOCKABLE_STATUSES: QuoteStatus[] = [
  QuoteStatus.DRAFT,
  QuoteStatus.PENDING_MANAGER_APPROVAL,
  QuoteStatus.PENDING_FINANCE_APPROVAL,
  QuoteStatus.PENDING_ADMIN_APPROVAL,
  QuoteStatus.REVISION_REQUIRED,
];

export interface PriorityProfile {
  tier: CustomerTier;
  marginPercent: number | null;
}

export interface PriorityRequesterContext extends PriorityProfile {
  customerName: string;
}

/**
 * Order margin % = (revenue - cost) / revenue, where revenue is post-
 * discount (money the business never collects isn't "revenue") - the same
 * definition already used for the upsell/cross-sell commercial-impact
 * preview. Null only if the order has no positive subtotal, which can't
 * happen for a quote that's actually reserving stock.
 */
export function computeMarginPercent(
  items: { quantity: number; unitPrice: Prisma.Decimal | number; cost: Prisma.Decimal | number }[],
  discountPercentage: Prisma.Decimal | number
): number | null {
  const subtotal = items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
  if (subtotal <= 0) return null;
  const revenue = subtotal * (1 - Number(discountPercentage) / 100);
  if (revenue <= 0) return null;
  const cost = items.reduce((sum, item) => sum + Number(item.cost) * item.quantity, 0);
  return ((revenue - cost) / revenue) * 100;
}

/**
 * True when `a` should win stock over `b`: better customer tier first, then
 * (only within the same tier) higher margin. An unknown margin never
 * outranks a known one, and two profiles that are genuinely tied are NOT a
 * priority conflict - that case falls back to the existing first-commit-wins
 * behavior rather than being flagged.
 */
export function isHigherPriority(a: PriorityProfile, b: PriorityProfile): boolean {
  const tierDiff = TIER_RANK[a.tier] - TIER_RANK[b.tier];
  if (tierDiff !== 0) return tierDiff < 0;
  if (a.marginPercent === null || b.marginPercent === null) return false;
  return a.marginPercent > b.marginPercent;
}

export interface BlockingCandidate {
  quoteId: string;
  quantity: number;
  tier: CustomerTier;
  marginPercent: number | null;
}

/**
 * Looks at every quote currently holding reserved stock for this
 * product+warehouse and figures out whether releasing some of the
 * lowest-priority ones would free enough of it for `requester`, who just
 * failed to reserve `shortfall` units there. Never releases anything itself
 * (see inventory.service.ts / stockConflict.service.ts) - just identifies
 * which blocking quotes the requester genuinely outranks, worst-priority
 * first, stopping as soon as enough quantity is accounted for. Returns an
 * empty array if no combination of outranked blockers would cover the
 * shortfall (a plain "no stock anywhere, not even from lower-priority
 * orders" conflict - nothing to flag).
 */
export async function findReleasableBlockers(
  productId: string,
  warehouseId: string,
  shortfall: number,
  requester: PriorityProfile
): Promise<BlockingCandidate[]> {
  const allocations = await prisma.quoteItemAllocation.findMany({
    where: {
      warehouseId,
      quoteItem: {
        productId,
        quote: { status: { in: BLOCKABLE_STATUSES } },
      },
    },
    include: {
      quoteItem: {
        include: {
          quote: {
            include: { customer: true, items: { include: { product: true } } },
          },
        },
      },
    },
  });

  const byQuote = new Map<string, BlockingCandidate>();
  for (const alloc of allocations) {
    const quote = alloc.quoteItem.quote;
    const existing = byQuote.get(quote.id);
    if (existing) {
      existing.quantity += alloc.quantity;
      continue;
    }
    byQuote.set(quote.id, {
      quoteId: quote.id,
      quantity: alloc.quantity,
      tier: quote.customer.tier,
      marginPercent: computeMarginPercent(
        quote.items.map((item) => ({
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          cost: item.product.cost,
        })),
        quote.discountPercentage
      ),
    });
  }

  const outranked = [...byQuote.values()]
    .filter((blocker) => isHigherPriority(requester, blocker))
    // Worst priority first, so the least-deserving holder is asked to give
    // up stock before a "less bad" one.
    .sort((a, b) => {
      const tierDiff = TIER_RANK[b.tier] - TIER_RANK[a.tier];
      if (tierDiff !== 0) return tierDiff;
      return (a.marginPercent ?? -Infinity) - (b.marginPercent ?? -Infinity);
    });

  const selected: BlockingCandidate[] = [];
  let covered = 0;
  for (const candidate of outranked) {
    if (covered >= shortfall) break;
    selected.push(candidate);
    covered += candidate.quantity;
  }
  return covered >= shortfall ? selected : [];
}

/**
 * Persists one StockPriorityConflict row per newly-identified blocker, for a
 * Manager/Admin to review and (if they agree) release. Uses the plain
 * `prisma` client, not the caller's transaction - the transaction that
 * discovered this conflict is about to roll back (that's exactly why the
 * reservation failed), but the conflict record itself must survive that
 * rollback so it actually reaches the review queue. Deduplicates against an
 * already-PENDING conflict for the same blocker/product/warehouse so a Rep
 * retrying the same save repeatedly doesn't spam the queue.
 */
export async function recordPriorityConflicts(
  productId: string,
  warehouseId: string,
  quantityNeeded: number,
  requester: PriorityRequesterContext,
  blockers: BlockingCandidate[]
): Promise<void> {
  for (const blocker of blockers) {
    const alreadyLogged = await prisma.stockPriorityConflict.findFirst({
      where: {
        blockingQuoteId: blocker.quoteId,
        productId,
        warehouseId,
        status: StockPriorityConflictStatus.PENDING,
      },
    });
    if (alreadyLogged) continue;

    await prisma.stockPriorityConflict.create({
      data: {
        productId,
        warehouseId,
        quantityNeeded,
        requestingCustomerName: requester.customerName,
        requestingTier: requester.tier,
        requestingMarginPercentage: requester.marginPercent,
        blockingQuoteId: blocker.quoteId,
        blockingQuantity: blocker.quantity,
        blockingTier: blocker.tier,
        blockingMarginPercentage: blocker.marginPercent,
      },
    });
  }
}
