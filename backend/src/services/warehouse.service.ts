import { prisma } from "../config/prisma";

export async function listWarehouses() {
  return prisma.warehouse.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}
