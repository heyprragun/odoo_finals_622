import {
  CustomerRequestStatus,
  CustomerTier,
  InvoiceStatus,
  Prisma,
  QuoteAuditAction,
  QuoteStatus,
  SubscriptionEventType,
  SubscriptionStatus,
} from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";
import { releaseAllocationsForQuote } from "./inventory.service";

// --- Tunable thresholds ---
// A deal still moving through the pipeline (or sitting as an untouched
// draft) with no update in this many days is presumed stalled - nobody has
// acted on it since.
const STALLED_DAYS = 5;
// Once a quote reaches APPROVED, this is how long the warehouse has to
// actually produce the full ordered quantity before "confirmed" starts
// reading as "slipping." Quote rows are never updated again after reaching
// APPROVED (see approval.service.ts), so updatedAt IS the approval moment.
const DELIVERY_SLIPPAGE_DAYS = 3;
// A Sales Rep needs at least this many historical (non-draft) quotes before
// their own average discount is trusted as a baseline - too few and one big
// deal would swing the average and manufacture false positives.
const DISCOUNT_ANOMALY_MIN_HISTORY = 3;
// How many percentage points above their OWN historical average triggers a
// flag - deliberately relative to the Rep's own norm, not a company-wide
// ceiling (that's what the separate tier/category discount-governance risk
// engine in discountGovernance.service.ts is for).
const DISCOUNT_ANOMALY_POINTS_THRESHOLD = 15;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysSince(date: Date, now: Date): number {
  return Math.floor((now.getTime() - date.getTime()) / MS_PER_DAY);
}

// Still moving through the approval pipeline - hasn't reached a resting
// point (APPROVED) yet. SUBMITTED is legacy (see schema.prisma) but old
// demo/seed rows can still carry it.
const IN_PIPELINE_STATUSES: QuoteStatus[] = [
  QuoteStatus.DRAFT,
  QuoteStatus.SUBMITTED,
  QuoteStatus.REVISION_REQUIRED,
  QuoteStatus.PENDING_MANAGER_APPROVAL,
  QuoteStatus.PENDING_FINANCE_APPROVAL,
  QuoteStatus.PENDING_ADMIN_APPROVAL,
];

// Every status where the discount is actually committed (submitted at
// least once) and the deal isn't dead - excludes DRAFT (not yet real) and
// REJECTED/CANCELLED (nothing left to manage).
const DISCOUNT_CANDIDATE_STATUSES: QuoteStatus[] = [
  ...IN_PIPELINE_STATUSES.filter((s) => s !== QuoteStatus.DRAFT),
  QuoteStatus.APPROVED,
];

// "Reject Deal" on a still-in-pipeline quote is the ordinary approval-style
// rejection (see approval.service.ts's own rejectQuote - same status
// transition and audit action, just reachable from Deal Health instead of
// the Approvals queue, and not restricted to whichever stage the quote
// happens to be sitting at). APPROVED is handled entirely separately below
// since it means unwinding a confirmed order, not just declining one.
const REJECTABLE_STATUSES: QuoteStatus[] = IN_PIPELINE_STATUSES;

export type DealHealthFlagType = "STALLED" | "DISCOUNT_ANOMALY" | "DELIVERY_SLIPPAGE";

const DEAL_HEALTH_INCLUDE = {
  customer: true,
  salesRep: true,
} satisfies Prisma.QuoteInclude;

type DealHealthQuote = Prisma.QuoteGetPayload<{ include: typeof DEAL_HEALTH_INCLUDE }>;

interface DealHealthFlagRow {
  id: string;
  quoteId: string;
  quoteNumber: string;
  customerName: string;
  customerTier: CustomerTier;
  salesRepName: string;
  status: QuoteStatus;
  totalAmount: number;
  flagType: DealHealthFlagType;
  issue: string;
  flaggedAt: Date;
}

function baseRow(quote: DealHealthQuote) {
  return {
    quoteId: quote.id,
    quoteNumber: quote.quoteNumber,
    customerName: quote.customer.name,
    customerTier: quote.customer.tier,
    salesRepName: quote.salesRep.name,
    status: quote.status,
    totalAmount: Number(quote.totalAmount),
  };
}

async function findStalledDeals(now: Date): Promise<Omit<DealHealthFlagRow, "id">[]> {
  const cutoff = new Date(now.getTime() - STALLED_DAYS * MS_PER_DAY);
  const quotes = await prisma.quote.findMany({
    where: { status: { in: IN_PIPELINE_STATUSES }, updatedAt: { lt: cutoff } },
    include: DEAL_HEALTH_INCLUDE,
    orderBy: { updatedAt: "asc" },
  });
  return quotes.map((quote) => ({
    ...baseRow(quote),
    flagType: "STALLED" as const,
    issue: `No activity for ${daysSince(quote.updatedAt, now)} days (still ${quote.status})`,
    flaggedAt: quote.updatedAt,
  }));
}

async function getRepDiscountBaselines(salesRepIds?: string[]) {
  const groups = await prisma.quote.groupBy({
    by: ["salesRepId"],
    where: {
      status: { not: QuoteStatus.DRAFT },
      ...(salesRepIds ? { salesRepId: { in: salesRepIds } } : {}),
    },
    _avg: { discountPercentage: true },
    _count: { _all: true },
  });
  return new Map(
    groups
      .filter((row) => row._count._all >= DISCOUNT_ANOMALY_MIN_HISTORY)
      .map((row) => [
        row.salesRepId,
        { average: Number(row._avg.discountPercentage ?? 0), historyCount: row._count._all },
      ])
  );
}

async function findDiscountAnomalies(now: Date): Promise<Omit<DealHealthFlagRow, "id">[]> {
  const baselineByRep = await getRepDiscountBaselines();
  if (baselineByRep.size === 0) return [];

  const candidates = await prisma.quote.findMany({
    where: {
      salesRepId: { in: [...baselineByRep.keys()] },
      status: { in: DISCOUNT_CANDIDATE_STATUSES },
    },
    include: DEAL_HEALTH_INCLUDE,
  });

  const flags: Omit<DealHealthFlagRow, "id">[] = [];
  for (const quote of candidates) {
    const baseline = baselineByRep.get(quote.salesRepId);
    if (!baseline) continue;
    const discountGiven = Number(quote.discountPercentage);
    const overBy = discountGiven - baseline.average;
    if (overBy > DISCOUNT_ANOMALY_POINTS_THRESHOLD) {
      flags.push({
        ...baseRow(quote),
        flagType: "DISCOUNT_ANOMALY",
        issue:
          `${discountGiven}% discount vs. this Rep's own ${baseline.average.toFixed(1)}% average ` +
          `(+${overBy.toFixed(1)} pts)`,
        flaggedAt: quote.updatedAt,
      });
    }
  }
  return flags;
}

async function findDeliverySlippage(now: Date): Promise<Omit<DealHealthFlagRow, "id">[]> {
  const cutoff = new Date(now.getTime() - DELIVERY_SLIPPAGE_DAYS * MS_PER_DAY);
  const quotes = await prisma.quote.findMany({
    where: { status: QuoteStatus.APPROVED, updatedAt: { lt: cutoff } },
    include: { ...DEAL_HEALTH_INCLUDE, items: { include: { allocations: true } } },
  });

  const flags: Omit<DealHealthFlagRow, "id">[] = [];
  for (const quote of quotes) {
    const shortItemCount = quote.items.filter((item) => {
      const allocated = item.allocations.reduce((sum, a) => sum + a.quantity, 0);
      return allocated < item.quantity;
    }).length;
    if (shortItemCount > 0) {
      flags.push({
        ...baseRow(quote),
        flagType: "DELIVERY_SLIPPAGE",
        issue:
          `${shortItemCount} item(s) still short on warehouse stock, ` +
          `${daysSince(quote.updatedAt, now)} days after approval`,
        flaggedAt: quote.updatedAt,
      });
    }
  }
  return flags;
}

export async function getDealHealthOverview() {
  const now = new Date();
  const [stalled, discountAnomaly, deliverySlippage] = await Promise.all([
    findStalledDeals(now),
    findDiscountAnomalies(now),
    findDeliverySlippage(now),
  ]);

  const flags: DealHealthFlagRow[] = [...stalled, ...discountAnomaly, ...deliverySlippage]
    .sort((a, b) => a.flaggedAt.getTime() - b.flaggedAt.getTime())
    .map((flag) => ({ id: `${flag.quoteId}:${flag.flagType}`, ...flag }));

  return {
    summary: {
      stalled: stalled.length,
      discountAnomaly: discountAnomaly.length,
      deliverySlippage: deliverySlippage.length,
    },
    flags,
  };
}

interface StalledFlagDetail {
  flagType: "STALLED";
  daysSinceActivity: number;
  thresholdDays: number;
  lastActivityAt: Date;
  lastAuditEntry: { action: QuoteAuditAction; user: string; note: string | null; createdAt: Date } | null;
}

interface DiscountAnomalyFlagDetail {
  flagType: "DISCOUNT_ANOMALY";
  discountPercentage: number;
  repAverageDiscountPercentage: number;
  overByPoints: number;
  thresholdPoints: number;
  repHistoryCount: number;
}

interface DeliverySlippageFlagDetail {
  flagType: "DELIVERY_SLIPPAGE";
  daysSinceApproval: number;
  thresholdDays: number;
  shortItems: { productName: string; orderedQuantity: number; allocatedQuantity: number; shortBy: number }[];
}

type DealHealthFlagDetail = StalledFlagDetail | DiscountAnomalyFlagDetail | DeliverySlippageFlagDetail;

/**
 * Recomputes, fresh, exactly which of the 3 checks this one quote currently
 * trips - same rules as getDealHealthOverview, just scoped to a single
 * quote so a click-through can show "whatever is wrong" with it. Nothing is
 * cached/stored, so this always reflects the quote's live state even if it
 * no longer matches whatever list it was clicked from.
 */
export async function getDealHealthDetail(quoteId: string) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      customer: true,
      salesRep: true,
      items: { include: { product: true, allocations: true } },
      auditEntries: { include: { user: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!quote) {
    throw ApiError.notFound("Quote not found");
  }

  const now = new Date();
  const flags: DealHealthFlagDetail[] = [];

  if (IN_PIPELINE_STATUSES.includes(quote.status)) {
    const days = daysSince(quote.updatedAt, now);
    if (days >= STALLED_DAYS) {
      const lastEntry = quote.auditEntries[0];
      flags.push({
        flagType: "STALLED",
        daysSinceActivity: days,
        thresholdDays: STALLED_DAYS,
        lastActivityAt: quote.updatedAt,
        lastAuditEntry: lastEntry
          ? { action: lastEntry.action, user: lastEntry.user.name, note: lastEntry.note, createdAt: lastEntry.createdAt }
          : null,
      });
    }
  }

  if (DISCOUNT_CANDIDATE_STATUSES.includes(quote.status)) {
    const baselineByRep = await getRepDiscountBaselines([quote.salesRepId]);
    const baseline = baselineByRep.get(quote.salesRepId);
    if (baseline) {
      const discountGiven = Number(quote.discountPercentage);
      const overBy = discountGiven - baseline.average;
      if (overBy > DISCOUNT_ANOMALY_POINTS_THRESHOLD) {
        flags.push({
          flagType: "DISCOUNT_ANOMALY",
          discountPercentage: discountGiven,
          repAverageDiscountPercentage: Math.round(baseline.average * 100) / 100,
          overByPoints: Math.round(overBy * 100) / 100,
          thresholdPoints: DISCOUNT_ANOMALY_POINTS_THRESHOLD,
          repHistoryCount: baseline.historyCount,
        });
      }
    }
  }

  if (quote.status === QuoteStatus.APPROVED) {
    const days = daysSince(quote.updatedAt, now);
    const shortItems = quote.items
      .map((item) => {
        const allocatedQuantity = item.allocations.reduce((sum, a) => sum + a.quantity, 0);
        return {
          productName: item.product.name,
          orderedQuantity: item.quantity,
          allocatedQuantity,
          shortBy: item.quantity - allocatedQuantity,
        };
      })
      .filter((item) => item.shortBy > 0);
    if (days >= DELIVERY_SLIPPAGE_DAYS && shortItems.length > 0) {
      flags.push({
        flagType: "DELIVERY_SLIPPAGE",
        daysSinceApproval: days,
        thresholdDays: DELIVERY_SLIPPAGE_DAYS,
        shortItems,
      });
    }
  }

  return {
    quote: {
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      status: quote.status,
      totalAmount: Number(quote.totalAmount),
      discountPercentage: Number(quote.discountPercentage),
      customer: { id: quote.customer.id, name: quote.customer.name, tier: quote.customer.tier },
      salesRep: { id: quote.salesRep.id, name: quote.salesRep.name },
      createdAt: quote.createdAt,
      updatedAt: quote.updatedAt,
    },
    flags,
  };
}

/**
 * Manager/Admin "Reject Deal" action from Deal Health. Two entirely
 * different operations depending on where the quote currently sits:
 *  - Still in the approval pipeline (DRAFT through PENDING_ADMIN_APPROVAL):
 *    an ordinary rejection - same status transition and audit action as
 *    approval.service.ts's own rejectQuote, just reachable regardless of
 *    stage and regardless of whose quote it is (a Manager/Admin can reject
 *    directly from here, unlike quote.service.ts's owner-only editing).
 *  - Already APPROVED: unwinds the whole confirmed order - the quote moves
 *    to CANCELLED (not REJECTED, which is only ever reachable pre-approval),
 *    its ACTIVE/PAUSED Subscriptions move to CANCELLED with a matching
 *    SubscriptionEvent each, its still-UNPAID Invoices move to CANCELLED
 *    (a PAID one is left alone - no refund flow exists), and its warehouse
 *    reservation is released. If it came from a CustomerRequest, that flips
 *    to CANCELLED too so the customer's own order list reflects it
 *    correctly (see customerPortal.service.ts's deriveOrderStatus).
 */
export async function rejectFlaggedDeal(quoteId: string, user: { id: string }, note: string) {
  await prisma.$transaction(async (tx) => {
    const quote = await tx.quote.findUnique({ where: { id: quoteId } });
    if (!quote) {
      throw ApiError.notFound("Quote not found");
    }

    if (quote.status === QuoteStatus.APPROVED) {
      const result = await tx.quote.updateMany({
        where: { id: quoteId, status: QuoteStatus.APPROVED },
        data: { status: QuoteStatus.CANCELLED },
      });
      if (result.count === 0) {
        throw ApiError.conflict("This deal just changed - please refresh and try again");
      }

      await tx.quoteAuditEntry.create({
        data: { quoteId, userId: user.id, action: QuoteAuditAction.MANAGER_CANCELLED, note },
      });

      const activeSubs = await tx.subscription.findMany({
        where: { quoteId, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAUSED] } },
      });
      if (activeSubs.length > 0) {
        await tx.subscription.updateMany({
          where: { id: { in: activeSubs.map((s) => s.id) } },
          data: { status: SubscriptionStatus.CANCELLED },
        });
        await tx.subscriptionEvent.createMany({
          data: activeSubs.map((sub) => ({
            subscriptionId: sub.id,
            type: SubscriptionEventType.CANCELLED,
            note: `Order cancelled: ${note}`,
          })),
        });
      }

      await tx.invoice.updateMany({
        where: { quoteId, status: InvoiceStatus.UNPAID },
        data: { status: InvoiceStatus.CANCELLED },
      });

      await releaseAllocationsForQuote(tx, quoteId);

      if (quote.customerRequestId) {
        await tx.customerRequest.updateMany({
          where: { id: quote.customerRequestId },
          data: { status: CustomerRequestStatus.CANCELLED },
        });
      }
      return;
    }

    if (!REJECTABLE_STATUSES.includes(quote.status)) {
      throw ApiError.badRequest("This deal is already closed and can't be rejected");
    }

    const result = await tx.quote.updateMany({
      where: { id: quoteId, status: quote.status },
      data: { status: QuoteStatus.REJECTED },
    });
    if (result.count === 0) {
      throw ApiError.conflict("This deal just changed - please refresh and try again");
    }

    await tx.quoteAuditEntry.create({
      data: { quoteId, userId: user.id, action: QuoteAuditAction.REJECTED, note },
    });

    await releaseAllocationsForQuote(tx, quoteId);
  });
}

/**
 * Manager/Admin "Nudge Sales Rep" action from Deal Health - a reminder,
 * nothing more. Never touches the quote's status (so it can't clear a
 * STALLED flag by itself - only the Rep actually updating the quote does
 * that), just logs a NUDGED audit entry. sanitizeQuote.ts surfaces the
 * latest one to the owning Rep as long as it's newer than the quote's own
 * updatedAt - once the Rep touches the quote again, it's considered acted
 * on and stops showing.
 */
export async function nudgeSalesRep(quoteId: string, user: { id: string }, note: string) {
  const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
  if (!quote) {
    throw ApiError.notFound("Quote not found");
  }
  await prisma.quoteAuditEntry.create({
    data: { quoteId, userId: user.id, action: QuoteAuditAction.NUDGED, note },
  });
}
