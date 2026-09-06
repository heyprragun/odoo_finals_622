import { CustomerTierChangeStatus, DiscountReviewStatus, QuoteStatus, Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { getDealHealthOverview } from "./dealHealth.service";

// How "on any interface, whenever content in a tab is updated" is actually
// decided, per nav tab. Two different shapes of tab need two different
// signals - conflating them would either leave a dot stuck on forever or
// never show one at all:
//  - A queue tab (Approvals, Deal Health, Negotiations, discount reviews)
//    has a natural "pending" state that clears the moment someone actually
//    resolves the item - the dot is just "is the queue non-empty," which
//    self-clears exactly when there's nothing left to check.
//  - A plain activity-history tab (Audit Trail, Subscriptions, tier-change
//    decisions) never "resolves" - it's just a growing log - so the dot
//    instead reflects "did anything land here recently," and ages out on
//    its own after RECENT_DAYS rather than needing any read/seen tracking.
const RECENT_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function recentCutoff(): Date {
  return new Date(Date.now() - RECENT_DAYS * MS_PER_DAY);
}

const PENDING_APPROVAL_STATUSES: QuoteStatus[] = [
  QuoteStatus.PENDING_MANAGER_APPROVAL,
  QuoteStatus.PENDING_FINANCE_APPROVAL,
  QuoteStatus.PENDING_ADMIN_APPROVAL,
];

// Broader than PENDING_APPROVAL_STATUSES - anything that has ever entered
// the approval workflow, matching what the Audit Trail tab actually shows.
const AUDIT_TRAIL_STATUSES: QuoteStatus[] = [
  ...PENDING_APPROVAL_STATUSES,
  QuoteStatus.APPROVED,
  QuoteStatus.REJECTED,
  QuoteStatus.REVISION_REQUIRED,
];

// Same "negotiable" set customerPortal.service.ts's listMyNegotiableQuotes
// uses - an approved deal the customer could still push back on, or a
// rejection they haven't responded to yet.
const NEGOTIABLE_QUOTE_STATUSES: QuoteStatus[] = [QuoteStatus.APPROVED, QuoteStatus.REJECTED];

export interface InternalNavAlerts {
  approvals: boolean;
  dealHealth: boolean;
  auditTrail: boolean;
  subscriptions: boolean;
  stockConflicts: boolean;
  grievances: boolean;
}

export async function getInternalNavAlerts(user: { id: string; role: Role }): Promise<InternalNavAlerts> {
  const scopeWhere = user.role === Role.SALES_REP ? { salesRepId: user.id } : {};
  const cutoff = recentCutoff();
  const isManagerOrAdmin = user.role === Role.MANAGER || user.role === Role.ADMIN;

  const [
    pendingApprovalCount,
    recentAuditCount,
    recentSubscriptionEventCount,
    dealHealth,
    pendingConflictCount,
    openGrievanceCount,
  ] = await Promise.all([
    prisma.quote.count({ where: { ...scopeWhere, status: { in: PENDING_APPROVAL_STATUSES } } }),
    prisma.quote.count({
      where: { ...scopeWhere, status: { in: AUDIT_TRAIL_STATUSES }, updatedAt: { gt: cutoff } },
    }),
    prisma.subscriptionEvent.count({ where: { createdAt: { gt: cutoff } } }),
    isManagerOrAdmin ? getDealHealthOverview() : null,
    isManagerOrAdmin ? prisma.stockPriorityConflict.count({ where: { status: "PENDING" } }) : 0,
    isManagerOrAdmin ? prisma.grievance.count({ where: { status: "OPEN" } }) : 0,
  ]);

  return {
    approvals: pendingApprovalCount > 0,
    dealHealth: (dealHealth?.flags.length ?? 0) > 0,
    auditTrail: recentAuditCount > 0,
    subscriptions: recentSubscriptionEventCount > 0,
    stockConflicts: pendingConflictCount > 0,
    grievances: openGrievanceCount > 0,
  };
}

export interface CustomerNavAlerts {
  negotiations: boolean;
  subscriptions: boolean;
  upgradeSubscription: boolean;
}

export async function getCustomerNavAlerts(customerId: string): Promise<CustomerNavAlerts> {
  const cutoff = recentCutoff();

  const [pendingDiscountReviewCount, negotiableCount, recentSubscriptionEventCount, recentTierDecisionCount] =
    await Promise.all([
      prisma.customerRequest.count({
        where: { customerId, discountReviewStatus: DiscountReviewStatus.PENDING },
      }),
      prisma.quote.count({ where: { customerId, status: { in: NEGOTIABLE_QUOTE_STATUSES } } }),
      prisma.subscriptionEvent.count({
        where: { subscription: { customerId }, createdAt: { gt: cutoff } },
      }),
      prisma.customerTierChangeRequest.count({
        where: { customerId, status: { not: CustomerTierChangeStatus.PENDING }, decidedAt: { gt: cutoff } },
      }),
    ]);

  return {
    negotiations: pendingDiscountReviewCount > 0 || negotiableCount > 0,
    subscriptions: recentSubscriptionEventCount > 0,
    upgradeSubscription: recentTierDecisionCount > 0,
  };
}
