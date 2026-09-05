import { prisma } from "../config/prisma";

export async function listCustomerRequests() {
  return prisma.customerRequest.findMany({
    include: { customer: true, items: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCustomerRequestById(id: string) {
  return prisma.customerRequest.findUnique({
    where: { id },
    include: { customer: true, items: { include: { product: true } } },
  });
}
