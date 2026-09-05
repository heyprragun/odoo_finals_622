import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";

// Read-only availability lookup. Allocation/splitting logic (deciding WHICH
// warehouse ships a given order) is a still-later phase and must not be
// added here - this only reports current on-hand/reserved/available state.
export async function getAvailabilityForProduct(productId: string) {
  return prisma.inventory.findMany({
    where: { productId, warehouse: { active: true } },
    include: { warehouse: true },
    orderBy: { warehouse: { name: "asc" } },
  });
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
