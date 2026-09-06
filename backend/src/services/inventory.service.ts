import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";
import { estimateShippingCostsPerWarehouse } from "./shippingAi.service";
import {
  findReleasableBlockers,
  recordPriorityConflicts,
  type PriorityRequesterContext,
} from "./stockPriority.service";

type DbClient = Prisma.TransactionClient | typeof prisma;

// Read-only availability lookup. Accepts an optional transaction client so
// callers that reserve/release stock as part of a larger quote transaction
// see a consistent view of in-flight changes.
export async function getAvailabilityForProduct(productId: string, client: DbClient = prisma) {
  return client.inventory.findMany({
    where: { productId, warehouse: { active: true } },
    include: { warehouse: true },
    orderBy: { warehouse: { name: "asc" } },
  });
}

export interface StockAllocationLine {
  warehouseId: string;
  warehouseName: string;
  location: string;
  quantityAllocated: number;
  quantityAvailable: number;
  // Groq's estimated per-unit cost (INR) to ship from this warehouse to the
  // destination location - null when no destination was given, or the AI
  // call failed/degraded (see shippingAi.service.ts; always falls back to
  // the stock-based greedy pick rather than blocking allocation on it).
  estimatedCostPerUnit: number | null;
  // estimatedCostPerUnit * quantityAllocated - what this line's share would
  // actually cost, for the allocation as suggested. Null under the same
  // conditions as estimatedCostPerUnit, or when nothing's allocated here.
  estimatedShippingCost: number | null;
}

export interface StockAllocationResult {
  productId: string;
  requestedQuantity: number;
  totalAvailable: number;
  fulfillable: boolean;
  shortfall: number;
  // True only when a destination was given AND Groq actually returned a
  // full set of per-warehouse cost estimates used to drive this split -
  // lets the UI say "cost-optimized" instead of just "suggested" when it's
  // actually true.
  costOptimized: boolean;
  allocations: StockAllocationLine[];
}

/**
 * Suggests which warehouse(s) should fill a given quantity of a product, and
 * flags outright when total stock can't cover it at all.
 *
 * Allocation strategy: when a destinationLocation is given and there's more
 * than one candidate warehouse, asks Groq (shippingAi.service.ts) to
 * estimate each warehouse's per-unit shipping cost to that destination and
 * fills the CHEAPEST warehouse(s) first - provably optimal for "one
 * destination, fixed per-unit cost per source, hard capacity per source"
 * (always fully exhaust the cheapest source before touching a pricier
 * one). Falls back to the original placeholder - fill whichever warehouse
 * has the most stock on hand first - whenever there's no destination, only
 * one candidate, or the AI call fails/returns incomplete data; this is an
 * optimization layered on a working default, never a hard dependency for
 * building a quote. Every warehouse that has any stock at all is included
 * (even at 0 allocated) so the Sales Rep can freely redistribute the split
 * across all of them, not just the ones this pass happened to pick.
 *
 * excludeQuoteItemId: when editing an EXISTING quote item's split, that
 * item's own current reservation is added back to each warehouse's
 * available count first - otherwise a warehouse fully consumed by this
 * same item's prior reservation would look like it has zero room, when
 * really that's exactly the stock this edit is about to redistribute.
 */
export async function suggestStockAllocation(
  productId: string,
  quantity: number,
  client: DbClient = prisma,
  excludeQuoteItemId?: string,
  destinationLocation?: string
): Promise<StockAllocationResult> {
  const rawInventory = await getAvailabilityForProduct(productId, client);

  let heldByThisItem = new Map<string, number>();
  if (excludeQuoteItemId) {
    const existing = await client.quoteItemAllocation.findMany({
      where: { quoteItemId: excludeQuoteItemId },
    });
    heldByThisItem = new Map(existing.map((a) => [a.warehouseId, a.quantity]));
  }
  const inventory = rawInventory.map((inv) => ({
    ...inv,
    quantityAvailable: inv.quantityAvailable + (heldByThisItem.get(inv.warehouseId) ?? 0),
  }));

  const totalAvailable = inventory.reduce((sum, inv) => sum + inv.quantityAvailable, 0);
  const fulfillable = totalAvailable >= quantity;
  const shortfall = Math.max(0, quantity - totalAvailable);

  const stockedCandidates = inventory.filter((inv) => inv.quantityAvailable > 0);

  let costPerWarehouse: Map<string, number> | null = null;
  if (destinationLocation && destinationLocation.trim().length > 0 && stockedCandidates.length > 1) {
    costPerWarehouse = await estimateShippingCostsPerWarehouse(
      destinationLocation,
      stockedCandidates.map((inv) => ({
        warehouseId: inv.warehouseId,
        warehouseName: inv.warehouse.name,
        location: inv.warehouse.location,
      }))
    );
  }

  const sorted = costPerWarehouse
    ? [...inventory].sort((a, b) => (costPerWarehouse!.get(a.warehouseId) ?? Infinity) - (costPerWarehouse!.get(b.warehouseId) ?? Infinity))
    : [...inventory].sort((a, b) => b.quantityAvailable - a.quantityAvailable);

  let remaining = quantity;
  const greedyAllocated = new Map<string, number>();
  for (const inv of sorted) {
    if (remaining <= 0) break;
    if (inv.quantityAvailable <= 0) continue;
    const take = Math.min(remaining, inv.quantityAvailable);
    greedyAllocated.set(inv.warehouseId, take);
    remaining -= take;
  }

  const allocations: StockAllocationLine[] = inventory
    .filter((inv) => inv.quantityAvailable > 0)
    .map((inv) => {
      const quantityAllocated = greedyAllocated.get(inv.warehouseId) ?? 0;
      const costPerUnit = costPerWarehouse?.get(inv.warehouseId) ?? null;
      return {
        warehouseId: inv.warehouseId,
        warehouseName: inv.warehouse.name,
        location: inv.warehouse.location,
        quantityAllocated,
        quantityAvailable: inv.quantityAvailable,
        estimatedCostPerUnit: costPerUnit,
        estimatedShippingCost: costPerUnit !== null && quantityAllocated > 0 ? costPerUnit * quantityAllocated : null,
      };
    });

  return {
    productId,
    requestedQuantity: quantity,
    totalAvailable,
    fulfillable,
    shortfall,
    costOptimized: costPerWarehouse !== null,
    allocations,
  };
}

export interface DesiredAllocation {
  warehouseId: string;
  quantity: number;
}

/**
 * Reserves stock for one quote item: moves the requested quantities from
 * quantityAvailable to quantityReserved per warehouse, and records the split
 * as QuoteItemAllocation rows. If the caller didn't supply a split (or it's
 * empty), falls back to the same greedy suggestion shown on screen -
 * destinationLocation lets that fallback be cost-optimized too (see
 * suggestStockAllocation). A caller-supplied split is the Rep's own
 * explicit choice and is persisted as-is, with no cost estimate attached -
 * only the auto-suggested fallback carries one. Must run inside the same
 * transaction as the quote item's own create/update so a failure here
 * rolls back the item too.
 */
export async function reserveAllocationsForItem(
  tx: Prisma.TransactionClient,
  quoteItemId: string,
  productId: string,
  itemQuantity: number,
  desired: DesiredAllocation[] | undefined,
  requester: PriorityRequesterContext,
  destinationLocation?: string
): Promise<void> {
  let toApply: (DesiredAllocation & { estimatedShippingCost?: number | null })[] = (desired ?? []).filter(
    (d) => d.quantity > 0
  );
  if (toApply.length === 0) {
    const suggestion = await suggestStockAllocation(productId, itemQuantity, tx, undefined, destinationLocation);
    toApply = suggestion.allocations
      .filter((a) => a.quantityAllocated > 0)
      .map((a) => ({
        warehouseId: a.warehouseId,
        quantity: a.quantityAllocated,
        estimatedShippingCost: a.estimatedShippingCost,
      }));
  }

  const totalRequested = toApply.reduce((sum, a) => sum + a.quantity, 0);
  if (totalRequested > itemQuantity) {
    throw ApiError.badRequest("Warehouse allocation cannot exceed the ordered quantity");
  }

  for (const alloc of toApply) {
    const result = await tx.inventory.updateMany({
      where: { warehouseId: alloc.warehouseId, productId, quantityAvailable: { gte: alloc.quantity } },
      data: {
        quantityAvailable: { decrement: alloc.quantity },
        quantityReserved: { increment: alloc.quantity },
      },
    });
    if (result.count === 0) {
      // Tier + margin priority (see stockPriority.service.ts): before giving
      // up, check whether this order actually outranks whoever is currently
      // holding the stock it needs here. If releasing some of their
      // reservation would cover the shortfall, don't silently reallocate -
      // log it for a Manager/Admin to review and explicitly decide instead.
      const inv = await tx.inventory.findUnique({
        where: { warehouseId_productId: { warehouseId: alloc.warehouseId, productId } },
      });
      const shortfall = Math.max(0, alloc.quantity - (inv?.quantityAvailable ?? 0));
      const releasable =
        shortfall > 0 ? await findReleasableBlockers(productId, alloc.warehouseId, shortfall, requester) : [];

      if (releasable.length > 0) {
        await recordPriorityConflicts(productId, alloc.warehouseId, shortfall, requester, releasable);
        throw ApiError.conflict(
          `Not enough stock at this warehouse for the requested quantity - however, this order (${requester.tier} tier` +
            `${requester.marginPercent !== null ? `, ${requester.marginPercent.toFixed(1)}% margin` : ""}) outranks ` +
            `${releasable.length} lower-priority order(s) currently holding it. A Manager/Admin has been notified to ` +
            "review reallocating that stock."
        );
      }
      throw ApiError.conflict(
        "One of the selected warehouses no longer has enough stock for this allocation - please refresh and try again"
      );
    }
    await tx.quoteItemAllocation.create({
      data: {
        quoteItemId,
        warehouseId: alloc.warehouseId,
        quantity: alloc.quantity,
        estimatedShippingCost: alloc.estimatedShippingCost ?? null,
      },
    });
  }
}

/**
 * Releases whatever stock the given quote items currently have reserved -
 * the inverse of reserveAllocationsForItem. Always call this BEFORE
 * deleting/replacing a quote's items (so the release reads the still-live
 * allocation rows) and whenever a quote reaches a status where it will
 * never be fulfilled (REJECTED, CANCELLED).
 */
export async function releaseAllocationsForItems(
  tx: Prisma.TransactionClient,
  quoteItemIds: string[]
): Promise<void> {
  if (quoteItemIds.length === 0) return;
  const allocations = await tx.quoteItemAllocation.findMany({
    where: { quoteItemId: { in: quoteItemIds } },
    include: { quoteItem: true },
  });
  for (const alloc of allocations) {
    await tx.inventory.updateMany({
      where: { warehouseId: alloc.warehouseId, productId: alloc.quoteItem.productId },
      data: {
        quantityAvailable: { increment: alloc.quantity },
        quantityReserved: { decrement: alloc.quantity },
      },
    });
  }
  // A released allocation no longer represents a live reservation - remove
  // the rows so this table only ever reflects current, active holds
  // (callers that are about to delete the QuoteItem itself would cascade
  // this away anyway; this also covers callers that keep the item, like a
  // rejection, where the row would otherwise dangle forever).
  await tx.quoteItemAllocation.deleteMany({ where: { quoteItemId: { in: quoteItemIds } } });
}

export async function releaseAllocationsForQuote(tx: Prisma.TransactionClient, quoteId: string): Promise<void> {
  const items = await tx.quoteItem.findMany({ where: { quoteId }, select: { id: true } });
  await releaseAllocationsForItems(
    tx,
    items.map((item) => item.id)
  );
}

/**
 * Aggregated per-product stock summary across all active warehouses - the
 * Fulfillment stock list. Shared/global data, not scoped to any Sales Rep:
 * every rep (and Manager/Finance/Admin) sees the same live numbers.
 */
export async function getStockSummary() {
  const products = await prisma.product.findMany({
    where: { active: true },
    include: { inventory: { where: { warehouse: { active: true } } } },
    orderBy: { name: "asc" },
  });

  return products.map((product) => {
    const totalAvailable = product.inventory.reduce((sum, inv) => sum + inv.quantityAvailable, 0);
    const totalReserved = product.inventory.reduce((sum, inv) => sum + inv.quantityReserved, 0);
    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      category: product.category,
      totalOnHand: totalAvailable + totalReserved,
      totalReserved,
      totalAvailable,
      warehouseCount: product.inventory.length,
    };
  });
}

// Admin-only stock write. quantityReserved is deliberately not settable here -
// that's allocation logic, still a later phase; this only ever sets
// on-hand/available quantity per warehouse.
export async function setInventoryForProduct(
  productId: string,
  entries: { warehouseId: string; quantityAvailable: number }[]
) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    throw ApiError.notFound("Product not found");
  }

  const warehouseIds = entries.map((e) => e.warehouseId);
  const warehouses = await prisma.warehouse.findMany({ where: { id: { in: warehouseIds } } });
  if (warehouses.length !== new Set(warehouseIds).size) {
    throw ApiError.badRequest("One or more warehouse ids are invalid");
  }

  for (const entry of entries) {
    await prisma.inventory.upsert({
      where: { warehouseId_productId: { warehouseId: entry.warehouseId, productId } },
      update: { quantityAvailable: entry.quantityAvailable },
      create: {
        warehouseId: entry.warehouseId,
        productId,
        quantityAvailable: entry.quantityAvailable,
      },
    });
  }

  return getAvailabilityForProduct(productId);
}
