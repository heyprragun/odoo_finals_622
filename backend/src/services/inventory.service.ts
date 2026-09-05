import { prisma } from "../config/prisma";

// Read-only availability lookup. Allocation/splitting logic belongs to the
// future fulfillment phase and must not be added here.
export async function getAvailabilityForProduct(productId: string) {
  return prisma.inventory.findMany({
    where: { productId, warehouse: { active: true } },
    include: { warehouse: true },
    orderBy: { warehouse: { name: "asc" } },
  });
}
