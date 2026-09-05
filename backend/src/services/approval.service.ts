import { Prisma, QuoteAuditAction, QuoteStatus, RiskLevel, Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";
import { assessDiscountRisk, getCategoryDiscountLimits } from "./discountGovernance.service";
import { createSubscriptionsForApprovedQuote } from "./subscription.service";
import { createInvoicesForApprovedQuote } from "./invoice.service";

interface AuthenticatedUser {
  id: string;
  role: Role;
}

// Every status a quote passes through once it has entered the approval
// workflow at least once (i.e. has been submitted and risk-assessed).
const PENDING_STATUSES: QuoteStatus[] = [
  QuoteStatus.PENDING_MANAGER_APPROVAL,
  QuoteStatus.PENDING_FINANCE_APPROVAL,
  QuoteStatus.PENDING_ADMIN_APPROVAL,
];

const APPROVAL_STATUSES: QuoteStatus[] = [
  QuoteStatus.PENDING_MANAGER_APPROVAL,
  QuoteStatus.PENDING_FINANCE_APPROVAL,
  QuoteStatus.PENDING_ADMIN_APPROVAL,
  QuoteStatus.APPROVED,
  QuoteStatus.REJECTED,
  QuoteStatus.REVISION_REQUIRED,
];

const APPROVAL_INCLUDE = {
  customer: true,
  items: { include: { product: true } },
  auditEntries: { include: { user: true }, orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.QuoteInclude;

type ApprovalQuote = Prisma.QuoteGetPayload<{ include: typeof APPROVAL_INCLUDE }>;

// "Confirmed" only ever means "Admin has signed off" - no quote reaches it
// any other way, regardless of risk level or which stages it passed through.
const WORKFLOW_STAGES = ["Submitted", "Sales Manager", "Finance", "Admin", "Confirmed"] as const;

function stageForStatus(status: QuoteStatus): "SALES_MANAGER" | "FINANCE" | "ADMIN" | null {
  if (status === QuoteStatus.PENDING_MANAGER_APPROVAL) return "SALES_MANAGER";
  if (status === QuoteStatus.PENDING_FINANCE_APPROVAL) return "FINANCE";
  if (status === QuoteStatus.PENDING_ADMIN_APPROVAL) return "ADMIN";
  return null;
}

function stageLabel(status: QuoteStatus): string {
  switch (status) {
    case QuoteStatus.PENDING_MANAGER_APPROVAL:
      return "Sales Manager";
    case QuoteStatus.PENDING_FINANCE_APPROVAL:
      return "Finance";
    case QuoteStatus.PENDING_ADMIN_APPROVAL:
      return "Admin";
    case QuoteStatus.APPROVED:
      return "Confirmed";
    case QuoteStatus.REJECTED:
      return "Rejected";
    case QuoteStatus.REVISION_REQUIRED:
      return "Returned";
    default:
      return status;
  }
}

function buildWorkflow(status: QuoteStatus) {
  let currentIndex = 0;
  let outcome: "IN_PROGRESS" | "REJECTED" | "RETURNED" = "IN_PROGRESS";

  switch (status) {
    case QuoteStatus.PENDING_MANAGER_APPROVAL:
      currentIndex = 1;
      break;
    case QuoteStatus.PENDING_FINANCE_APPROVAL:
      currentIndex = 2;
      break;
    case QuoteStatus.PENDING_ADMIN_APPROVAL:
      currentIndex = 3;
      break;
    case QuoteStatus.APPROVED:
      currentIndex = 4;
      break;
    case QuoteStatus.REJECTED:
      currentIndex = -1;
      outcome = "REJECTED";
      break;
    case QuoteStatus.REVISION_REQUIRED:
      currentIndex = -1;
      outcome = "RETURNED";
      break;
  }

  return { stages: WORKFLOW_STAGES, currentIndex, outcome };
}

async function getPrimaryUserForRole(client: Prisma.TransactionClient, role: Role) {
  return client.user.findFirst({ where: { role }, orderBy: { createdAt: "asc" } });
}

function assignedToLabel(
  quote: Pick<ApprovalQuote, "status" | "riskLevel" | "auditEntries">,
  manager: { name: string } | null,
  finance: { name: string } | null,
  admin: { name: string } | null
): string | null {
  if (quote.status === QuoteStatus.PENDING_MANAGER_APPROVAL) return manager?.name ?? "Sales Manager";
  if (quote.status === QuoteStatus.PENDING_FINANCE_APPROVAL) return finance?.name ?? "Finance";
  if (quote.status === QuoteStatus.PENDING_ADMIN_APPROVAL) return admin?.name ?? "Admin";
  const lastEntry = quote.auditEntries[quote.auditEntries.length - 1];
  return lastEntry?.user.name ?? null;
}

function formatListItem(
  quote: ApprovalQuote,
  manager: { name: string } | null,
  finance: { name: string } | null,
  admin: { name: string } | null
) {
  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    customer: { id: quote.customer.id, name: quote.customer.name, tier: quote.customer.tier },
    status: quote.status,
    riskLevel: quote.riskLevel,
    stageLabel: stageLabel(quote.status),
    assignedTo: assignedToLabel(quote, manager, finance, admin),
    totalAmount: Number(quote.totalAmount),
    updatedAt: quote.updatedAt,
  };
}

/**
 * Layer 2 (resource authorization): only the Sales Manager may act while a
 * quote is at the Sales Manager stage, only Finance while at the Finance
 * stage, only Admin while at the Admin (master approval) stage. ADMIN can
 * also act at the Manager/Finance stages as an oversight override. This is
 * enforced here regardless of what the frontend shows/hides.
 */
function assertActorCanActOnStage(status: QuoteStatus, user: AuthenticatedUser) {
  const stage = stageForStatus(status);
  if (!stage) {
    throw ApiError.badRequest("This quote is not currently awaiting approval");
  }
  if (user.role === Role.ADMIN) return;
  if (stage === "SALES_MANAGER" && user.role !== Role.MANAGER) {
    throw ApiError.forbidden("Only the Sales Manager can act on this quote at its current stage");
  }
  if (stage === "FINANCE" && user.role !== Role.FINANCE) {
    throw ApiError.forbidden("Only Finance can act on this quote at its current stage");
  }
  if (stage === "ADMIN") {
    // ADMIN already returned above, so reaching here means a non-admin
    // tried to act at the Admin master-approval stage.
    throw ApiError.forbidden("Only Admin can give final approval on this quote");
  }
}

export async function listApprovals(user: AuthenticatedUser, pendingOnly: boolean) {
  const scopeWhere: Prisma.QuoteWhereInput =
    user.role === Role.SALES_REP ? { salesRepId: user.id } : {};
  const baseWhere: Prisma.QuoteWhereInput = { ...scopeWhere, status: { in: APPROVAL_STATUSES } };

  const [summaryRows, quotes, manager, finance, admin] = await Promise.all([
    prisma.quote.findMany({ where: baseWhere, select: { status: true } }),
    prisma.quote.findMany({
      where: pendingOnly
        ? {
            ...baseWhere,
            status: { in: PENDING_STATUSES },
          }
        : baseWhere,
      include: APPROVAL_INCLUDE,
      orderBy: { updatedAt: "desc" },
    }),
    getPrimaryUserForRole(prisma, Role.MANAGER),
    getPrimaryUserForRole(prisma, Role.FINANCE),
    getPrimaryUserForRole(prisma, Role.ADMIN),
  ]);

  const summary = {
    pending: summaryRows.filter((q) => PENDING_STATUSES.includes(q.status)).length,
    returned: summaryRows.filter((q) => q.status === QuoteStatus.REVISION_REQUIRED).length,
    approved: summaryRows.filter((q) => q.status === QuoteStatus.APPROVED).length,
  };

  return {
    summary,
    items: quotes.map((quote) => formatListItem(quote, manager, finance, admin)),
  };
}

export async function getApprovalDetail(quoteId: string, user: AuthenticatedUser) {
  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, include: APPROVAL_INCLUDE });
  if (!quote) {
    throw ApiError.notFound("Quote not found");
  }
  if (user.role === Role.SALES_REP && quote.salesRepId !== user.id) {
    throw ApiError.forbidden("You can only view approval details for your own quotes");
  }
  if (!APPROVAL_STATUSES.includes(quote.status)) {
    throw ApiError.badRequest("This quote has not entered the approval workflow");
  }

  const limits = await getCategoryDiscountLimits(prisma);
  const { lines } = assessDiscountRisk(quote.items, quote.discountPercentage, limits);

  const [manager, finance, admin] = await Promise.all([
    getPrimaryUserForRole(prisma, Role.MANAGER),
    getPrimaryUserForRole(prisma, Role.FINANCE),
    getPrimaryUserForRole(prisma, Role.ADMIN),
  ]);

  return {
    ...formatListItem(quote, manager, finance, admin),
    customerTier: quote.customer.tier,
    lines,
    workflow: buildWorkflow(quote.status),
    auditTrail: quote.auditEntries.map((entry) => ({
      id: entry.id,
      user: entry.user.name,
      action: entry.action,
      note: entry.note,
      createdAt: entry.createdAt,
    })),
  };
}

/**
 * Re-checks role/stage AND performs the status transition inside one
 * transaction, guarding the update with a `status: <status just read>`
 * WHERE clause. Under Postgres's row-level locking this makes concurrent
 * approve/return/reject attempts on the same quote serialize correctly: the
 * second transaction blocks on the row lock, then re-evaluates its WHERE
 * clause against the now-committed new status and matches zero rows -
 * which is how duplicate/conflicting actions get detected and rejected.
 */
async function performAction(
  quoteId: string,
  user: AuthenticatedUser,
  action: QuoteAuditAction,
  computeNextStatus: (quote: { status: QuoteStatus; riskLevel: RiskLevel | null }) => QuoteStatus,
  note: string | null
) {
  await prisma.$transaction(async (tx) => {
    const quote = await tx.quote.findUnique({ where: { id: quoteId } });
    if (!quote) {
      throw ApiError.notFound("Quote not found");
    }
    assertActorCanActOnStage(quote.status, user);

    const nextStatus = computeNextStatus(quote);
    const result = await tx.quote.updateMany({
      where: { id: quoteId, status: quote.status },
      data: { status: nextStatus },
    });
    if (result.count === 0) {
      throw ApiError.conflict(
        "This quote's approval status just changed - please refresh and try again"
      );
    }

    await tx.quoteAuditEntry.create({
      data: { quoteId, userId: user.id, action, note },
    });

    if (nextStatus === QuoteStatus.APPROVED) {
      await createSubscriptionsForApprovedQuote(tx, quoteId);
      await createInvoicesForApprovedQuote(tx, quoteId);
    }
  });

  return getApprovalDetail(quoteId, user);
}

export async function approveQuote(quoteId: string, user: AuthenticatedUser, note: string | undefined) {
  return performAction(
    quoteId,
    user,
    QuoteAuditAction.APPROVED,
    (quote) => {
      if (quote.status === QuoteStatus.PENDING_MANAGER_APPROVAL) {
        // Manager approving: only HIGH risk continues on to Finance. MEDIUM
        // risk goes straight to Admin - Finance only ever sees HIGH-risk
        // deals. Either way, Manager approving never finalizes a quote by
        // itself; Admin's master approval always comes next.
        return quote.riskLevel === RiskLevel.HIGH
          ? QuoteStatus.PENDING_FINANCE_APPROVAL
          : QuoteStatus.PENDING_ADMIN_APPROVAL;
      }
      if (quote.status === QuoteStatus.PENDING_FINANCE_APPROVAL) {
        // Finance approving a HIGH-risk deal still isn't final - it still
        // needs Admin's master approval.
        return QuoteStatus.PENDING_ADMIN_APPROVAL;
      }
      // PENDING_ADMIN_APPROVAL: Admin's approval is the only thing that can
      // ever finalize a quote - no order is confirmed without it.
      return QuoteStatus.APPROVED;
    },
    note ?? null
  );
}

export async function returnQuoteForRevision(quoteId: string, user: AuthenticatedUser, note: string) {
  return performAction(quoteId, user, QuoteAuditAction.RETURNED, () => QuoteStatus.REVISION_REQUIRED, note);
}

export async function rejectQuote(quoteId: string, user: AuthenticatedUser, note: string) {
  return performAction(quoteId, user, QuoteAuditAction.REJECTED, () => QuoteStatus.REJECTED, note);
}
