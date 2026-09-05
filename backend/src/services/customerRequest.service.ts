import { CustomerRequestStatus } from "@prisma/client";
import { prisma } from "../config/prisma";

// Active = still actionable by a Sales Rep. Once a request's quotation has
// been submitted (CONVERTED) or the request was cancelled, it drops out of
// the default queue - it still exists in the DB for history/audit.
const INACTIVE_STATUSES: CustomerRequestStatus[] = [
  CustomerRequestStatus.CONVERTED,
  CustomerRequestStatus.CANCELLED,
];

export async function listActiveCustomerRequests() {
  return prisma.customerRequest.findMany({
    where: { status: { notIn: INACTIVE_STATUSES } },
    include: { customer: true, items: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCustomerRequestById(id: string) {
  return prisma.customerRequest.findUnique({
    where: { id },
    include: {
      customer: true,
      items: { include: { product: true } },
      quote: { select: { id: true, quoteNumber: true, status: true } },
    },
  });
}
