import { prisma } from "../config/prisma";

export async function listCustomers() {
  return prisma.customer.findMany({ orderBy: { name: "asc" } });
}

export async function getCustomerById(id: string) {
  return prisma.customer.findUnique({ where: { id } });
}
