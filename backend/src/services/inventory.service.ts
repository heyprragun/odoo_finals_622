import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";

// Read-only availability lookup.
export async function getAvailabilityForProduct(productId: string) {
  return prisma.inventory.findMany({
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
  // Provision for a later phase: once customer/warehouse geolocation is
  // wired up, an AI call will estimate per-warehouse shipping cost here.
  // Always null today - no cost model exists yet.
  estimatedShippingCost: number | null;
}

export interface StockAllocationResult {
  productId: string;
  requestedQuantity: number;
  totalAvailable: number;
  fulfillable: boolean;
  shortfall: number;
  allocations: StockAllocationLine[];
}

/**
 * Suggests which warehouse(s) should fill a given quantity of a product, and
 * flags outright when total stock can't cover it at all. The allocation
 * strategy is a placeholder - fill from whichever warehouse has the most
 * stock on hand first - since there's no location data yet to allocate by
 * proximity/shipping cost; that's the "later phase" this return shape
 * already has a slot for (estimatedShippingCost).
 */
export async function suggestStockAllocation(
  productId: string,
  quantity: number
): Promise<StockAllocationResult> {
  const inventory = await getAvailabilityForProduct(productId);
  const totalAvailable = inventory.reduce((sum, inv) => sum + inv.quantityAvailable, 0);
  const fulfillable = totalAvailable >= quantity;
  const shortfall = Math.max(0, quantity - totalAvailable);

  const sortedByStock = [...inventory].sort((a, b) => b.quantityAvailable - a.quantityAvailable);
  let remaining = quantity;
  const allocations: StockAllocationLine[] = [];
  for (const inv of sortedByStock) {
    if (remaining <= 0) break;
    if (inv.quantityAvailable <= 0) continue;
    const take = Math.min(remaining, inv.quantityAvailable);
    allocations.push({
      warehouseId: inv.warehouseId,
      warehouseName: inv.warehouse.name,
      location: inv.warehouse.location,
      quantityAllocated: take,
      quantityAvailable: inv.quantityAvailable,
      estimatedShippingCost: null,
    });
    remaining -= take;
  }

  return { productId, requestedQuantity: quantity, totalAvailable, fulfillable, shortfall, allocations };
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
