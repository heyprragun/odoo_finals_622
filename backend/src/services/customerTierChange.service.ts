import { CustomerTier, CustomerTierChangeStatus, CustomerTierChangeType, Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";

// Higher rank = better tier. Used purely to classify a request as an
// UPGRADE or DOWNGRADE at creation time - not stored anywhere else.
const TIER_RANK: Record<CustomerTier, number> = { BRONZE: 1, SILVER: 2, GOLD: 3 };

function formatMyRequest(row: {
  id: string;
  requestedTier: CustomerTier;
  type: CustomerTierChangeType;
  status: CustomerTierChangeStatus;
  customerNote: string | null;
  adminNote: string | null;
  createdAt: Date;
  decidedAt: Date | null;
}) {
  return {
    id: row.id,
    requestedTier: row.requestedTier,
    type: row.type,
    status: row.status,
    customerNote: row.customerNote,
    adminNote: row.adminNote,
    createdAt: row.createdAt,
    decidedAt: row.decidedAt,
  };
}

// Everything the portal's "Upgrade Subscription" tab needs: the company's
// current plan tier plus their own request history (any status).
export async function getMyTierChangeInfo(customerId: string) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    throw ApiError.notFound("Customer not found");
  }

  const requests = await prisma.customerTierChangeRequest.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
  });

  return {
    currentTier: customer.tier,
    requests: requests.map(formatMyRequest),
  };
}

/**
 * Customer-initiated (portal's "Upgrade Subscription" tab) request to move
 * the whole company to a different plan tier. Never applied automatically -
 * Admin reviews and decides (see decideTierChangeRequest below), which
 * writes the new tier straight onto Customer.tier - this immediately
 * changes which discount-governance limits apply to every future quote.
 */
export async function requestTierChange(
  customerId: string,
  requestedTier: CustomerTier,
  note: string | undefined
) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    throw ApiError.notFound("Customer not found");
  }
  if (requestedTier === customer.tier) {
    throw ApiError.badRequest("Requested tier must be different from your current tier");
  }

  const existingPending = await prisma.customerTierChangeRequest.findFirst({
    where: { customerId, status: CustomerTierChangeStatus.PENDING },
  });
  if (existingPending) {
    throw ApiError.conflict("You already have a pending tier change request");
  }

  await prisma.customerTierChangeRequest.create({
    data: {
      customerId,
      requestedTier,
      type:
        TIER_RANK[requestedTier] > TIER_RANK[customer.tier]
          ? CustomerTierChangeType.UPGRADE
          : CustomerTierChangeType.DOWNGRADE,
      customerNote: note,
    },
  });

  return getMyTierChangeInfo(customerId);
}

const PENDING_INCLUDE = { customer: true } satisfies Prisma.CustomerTierChangeRequestInclude;
type PendingRow = Prisma.CustomerTierChangeRequestGetPayload<{ include: typeof PENDING_INCLUDE }>;

function formatPendingRequest(row: PendingRow) {
  return {
    id: row.id,
    requestedTier: row.requestedTier,
    type: row.type,
    status: row.status,
    customerNote: row.customerNote,
    adminNote: row.adminNote,
    createdAt: row.createdAt,
    decidedAt: row.decidedAt,
    customer: { id: row.customer.id, name: row.customer.name, currentTier: row.customer.tier },
  };
}

// Admin-only queue - every company's pending asks in one place, matching
// how every other approval queue in this app is unscoped for its deciding
// role.
export async function listPendingTierChangeRequests() {
  const rows = await prisma.customerTierChangeRequest.findMany({
    where: { status: CustomerTierChangeStatus.PENDING },
    include: PENDING_INCLUDE,
    orderBy: { createdAt: "asc" },
  });
  return rows.map(formatPendingRequest);
}

export async function decideTierChangeRequest(
  requestId: string,
  decidedByUserId: string,
  decision: "APPROVE" | "REJECT",
  adminNote: string | undefined
) {
  await prisma.$transaction(async (tx) => {
    const request = await tx.customerTierChangeRequest.findUnique({ where: { id: requestId } });
    if (!request) {
      throw ApiError.notFound("Tier change request not found");
    }
    if (request.status !== CustomerTierChangeStatus.PENDING) {
      throw ApiError.badRequest("This request has already been decided");
    }

    const result = await tx.customerTierChangeRequest.updateMany({
      where: { id: requestId, status: CustomerTierChangeStatus.PENDING },
      data: {
        status: decision === "APPROVE" ? CustomerTierChangeStatus.APPROVED : CustomerTierChangeStatus.REJECTED,
        adminNote,
        decidedAt: new Date(),
        decidedByUserId,
      },
    });
    if (result.count === 0) {
      throw ApiError.conflict("This request was just decided - please refresh and try again");
    }

    if (decision === "APPROVE") {
      await tx.customer.update({ where: { id: request.customerId }, data: { tier: request.requestedTier } });
    }
  });

  return listPendingTierChangeRequests();
}
