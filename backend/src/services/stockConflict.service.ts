import { Prisma, QuoteAuditAction, QuoteStatus, Role, StockPriorityConflictStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";
import { BLOCKABLE_STATUSES } from "./stockPriority.service";

interface AuthenticatedUser {
  id: string;
  role: Role;
}

const CONFLICT_INCLUDE = {
  product: true,
  warehouse: true,
  blockingQuote: { include: { customer: true } },
} satisfies Prisma.StockPriorityConflictInclude;

type ConflictRow = Prisma.StockPriorityConflictGetPayload<{ include: typeof CONFLICT_INCLUDE }>;

function toNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value);
}

function format(row: ConflictRow) {
  return {
    id: row.id,
    product: { id: row.product.id, name: row.product.name, sku: row.product.sku },
    warehouse: { id: row.warehouse.id, name: row.warehouse.name, location: row.warehouse.location },
    quantityNeeded: row.quantityNeeded,
    requestingCustomerName: row.requestingCustomerName,
    requestingTier: row.requestingTier,
    requestingMarginPercentage: toNumber(row.requestingMarginPercentage),
    blockingQuote: {
      id: row.blockingQuote.id,
      quoteNumber: row.blockingQuote.quoteNumber,
      status: row.blockingQuote.status,
      customerName: row.blockingQuote.customer.name,
    },
    blockingQuantity: row.blockingQuantity,
    blockingTier: row.blockingTier,
    blockingMarginPercentage: toNumber(row.blockingMarginPercentage),
    status: row.status,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
  };
}

export async function listStockConflicts(pendingOnly: boolean) {
  const rows = await prisma.stockPriorityConflict.findMany({
    where: pendingOnly ? { status: StockPriorityConflictStatus.PENDING } : {},
    include: CONFLICT_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(format);
}

/**
 * Manager/Admin agrees the higher-priority requester should get this stock:
 * releases (up to) the implicated quantity from the blocking quote's own
 * allocation there, and kicks that quote back to REVISION_REQUIRED so its
 * Sales Rep notices (via the same "returned for revision" banner/edit link
 * as an approver's own Return for Revision) and re-picks a warehouse or
 * quantity. Never touches an APPROVED/REJECTED/CANCELLED quote - if the
 * blocking quote's status moved on since the conflict was logged, this
 * fails cleanly rather than reallocating stock nobody agreed to give up.
 */
export async function releaseStockConflict(conflictId: string, user: AuthenticatedUser) {
  return prisma.$transaction(async (tx) => {
    const conflict = await tx.stockPriorityConflict.findUnique({ where: { id: conflictId } });
    if (!conflict) {
      throw ApiError.notFound("Conflict not found");
    }
    if (conflict.status !== StockPriorityConflictStatus.PENDING) {
      throw ApiError.conflict("This conflict has already been resolved");
    }

    const quote = await tx.quote.findUnique({ where: { id: conflict.blockingQuoteId }, include: { items: true } });
    if (!quote) {
      throw ApiError.notFound("The blocking quote no longer exists");
    }

    const item = quote.items.find((i) => i.productId === conflict.productId);
    if (!item) {
      throw ApiError.conflict("The blocking quote no longer has this product on it - nothing to release");
    }
    const allocation = await tx.quoteItemAllocation.findUnique({
      where: { quoteItemId_warehouseId: { quoteItemId: item.id, warehouseId: conflict.warehouseId } },
    });
    if (!allocation) {
      throw ApiError.conflict("The blocking quote no longer holds stock at this warehouse - nothing to release");
    }

    const releaseQty = Math.min(allocation.quantity, conflict.blockingQuantity);

    await tx.inventory.updateMany({
      where: { warehouseId: conflict.warehouseId, productId: conflict.productId },
      data: {
        quantityAvailable: { increment: releaseQty },
        quantityReserved: { decrement: releaseQty },
      },
    });

    if (releaseQty >= allocation.quantity) {
      await tx.quoteItemAllocation.delete({ where: { id: allocation.id } });
    } else {
      await tx.quoteItemAllocation.update({
        where: { id: allocation.id },
        data: { quantity: allocation.quantity - releaseQty },
      });
    }

    // Guarded transition: only succeeds if the blocking quote is still in a
    // status where its stock was ever up for grabs - if it's since become
    // APPROVED (or REJECTED/CANCELLED, though those would have already
    // released their allocation above), this matches zero rows and the
    // whole release aborts instead of silently touching a confirmed order.
    const guarded = await tx.quote.updateMany({
      where: { id: quote.id, status: { in: BLOCKABLE_STATUSES } },
      data: { status: QuoteStatus.REVISION_REQUIRED },
    });
    if (guarded.count === 0) {
      throw ApiError.conflict(
        "This quote's status has changed since the conflict was logged and its stock can no longer be reallocated - dismiss this conflict instead"
      );
    }

    await tx.quoteAuditEntry.create({
      data: {
        quoteId: quote.id,
        userId: user.id,
        action: QuoteAuditAction.RETURNED,
        note:
          `${releaseQty} unit(s) reassigned to a higher-priority order (${conflict.requestingTier} tier, ` +
          `${conflict.requestingCustomerName}) - please update this quote's warehouse allocation.`,
      },
    });

    await tx.stockPriorityConflict.update({
      where: { id: conflictId },
      data: { status: StockPriorityConflictStatus.RESOLVED, resolvedByUserId: user.id, resolvedAt: new Date() },
    });
  });
}

export async function dismissStockConflict(conflictId: string, user: AuthenticatedUser) {
  const result = await prisma.stockPriorityConflict.updateMany({
    where: { id: conflictId, status: StockPriorityConflictStatus.PENDING },
    data: { status: StockPriorityConflictStatus.DISMISSED, resolvedByUserId: user.id, resolvedAt: new Date() },
  });
  if (result.count === 0) {
    throw ApiError.conflict("This conflict has already been resolved");
  }
}
