import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";
import type { CreateWarehouseInput } from "../validation/warehouse.validation";

export async function listWarehouses() {
  return prisma.warehouse.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}

export async function createWarehouse(input: CreateWarehouseInput) {
  return prisma.warehouse.create({ data: { name: input.name, location: input.location } });
}

/**
 * The inverse of inventory.service.ts's getAvailabilityForProduct (which is
 * per-product, across every warehouse) - this is per-warehouse, across every
 * active product. Every active product gets a row even with zero stock here
 * (no Inventory row yet), same convention ProductEdit.tsx's own "Warehouse
 * Inventory" editor already uses for the reverse view - so "add stock for a
 * product not yet carried here" is just editing that row's quantity, not a
 * separate add-row action.
 */
export async function getWarehouseDetail(warehouseId: string) {
  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) {
    throw ApiError.notFound("Warehouse not found");
  }

  const products = await prisma.product.findMany({
    where: { active: true },
    include: { inventory: { where: { warehouseId } } },
    orderBy: { name: "asc" },
  });

  const items = products.map((product) => {
    const inv = product.inventory[0];
    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      category: product.category,
      quantityAvailable: inv?.quantityAvailable ?? 0,
      quantityReserved: inv?.quantityReserved ?? 0,
    };
  });

  return {
    id: warehouse.id,
    name: warehouse.name,
    location: warehouse.location,
    summary: {
      productsStocked: items.filter((i) => i.quantityAvailable > 0 || i.quantityReserved > 0).length,
      totalUnitsAvailable: items.reduce((sum, i) => sum + i.quantityAvailable, 0),
    },
    items,
  };
}
