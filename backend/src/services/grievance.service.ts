import { GrievanceStatus, Prisma, QuoteStatus, Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";

interface Actor {
  id: string;
  role: Role;
  customerId?: string | null;
}

const MESSAGE_INCLUDE = { user: true } satisfies Prisma.GrievanceMessageInclude;
type MessageRow = Prisma.GrievanceMessageGetPayload<{ include: typeof MESSAGE_INCLUDE }>;

function formatMessage(row: MessageRow) {
  return {
    id: row.id,
    message: row.message,
    createdAt: row.createdAt,
    user: { id: row.user.id, name: row.user.name, role: row.user.role },
  };
}

const DETAIL_INCLUDE = {
  quote: { include: { customer: true } },
  messages: { include: { user: true }, orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.GrievanceInclude;
type DetailRow = Prisma.GrievanceGetPayload<{ include: typeof DETAIL_INCLUDE }>;

function formatDetail(g: DetailRow) {
  return {
    id: g.id,
    status: g.status,
    description: g.description,
    createdAt: g.createdAt,
    resolvedAt: g.resolvedAt,
    quote: { id: g.quote.id, quoteNumber: g.quote.quoteNumber, totalAmount: Number(g.quote.totalAmount) },
    customer: { id: g.quote.customer.id, name: g.quote.customer.name, tier: g.quote.customer.tier },
    messages: g.messages.map(formatMessage),
  };
}

async function getGrievanceDetailById(id: string) {
  const grievance = await prisma.grievance.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!grievance) {
    throw ApiError.notFound("Grievance not found");
  }
  return formatDetail(grievance);
}

// ---------------------------------------------------------------------
// Customer-side
// ---------------------------------------------------------------------

/**
 * "Delivered orders" = the customer portal's own terminal order status
 * (deriveOrderStatus in customerPortal.service.ts collapses a customer's
 * view to IN_PROGRESS/APPROVED/CANCELLED - APPROVED is the only "done,
 * confirmed" state that exists today, there's no separate shipping/delivery
 * tracking in this app). Scoped to CustomerRequest-based orders, same
 * universe "My Orders" already shows the customer - a manually-started
 * quote with no request behind it was never something the customer sees as
 * "their order" in the portal to begin with.
 */
export async function listDeliveredOrders(customerId: string) {
  const requests = await prisma.customerRequest.findMany({
    where: { customerId, quote: { status: QuoteStatus.APPROVED } },
    include: {
      items: { include: { product: true } },
      quote: { include: { grievance: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return requests
    .filter((r): r is typeof r & { quote: NonNullable<(typeof r)["quote"]> } => r.quote !== null)
    .map((r) => ({
      quoteId: r.quote.id,
      quoteNumber: r.quote.quoteNumber,
      totalAmount: Number(r.quote.totalAmount),
      approvedAt: r.quote.updatedAt,
      items: r.items.map((item) => ({ productName: item.product.name, quantity: item.requestedQuantity })),
      grievance: r.quote.grievance ? { id: r.quote.grievance.id, status: r.quote.grievance.status } : null,
    }));
}

export async function listMyGrievances(customerId: string) {
  const grievances = await prisma.grievance.findMany({
    where: { customerId },
    include: DETAIL_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return grievances.map(formatDetail);
}

/** Null (not a 404) when this order simply has no grievance yet - the
 * frontend uses that to decide whether to show the raise-grievance form or
 * the existing thread. */
export async function getGrievanceByQuoteForCustomer(quoteId: string, customerId: string) {
  const grievance = await prisma.grievance.findUnique({ where: { quoteId } });
  if (!grievance) return null;
  if (grievance.customerId !== customerId) {
    throw ApiError.forbidden("You can only view your own grievances");
  }
  return getGrievanceDetailById(grievance.id);
}

export async function createGrievance(customerId: string, quoteId: string, description: string) {
  const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
  if (!quote) {
    throw ApiError.notFound("Order not found");
  }
  if (quote.customerId !== customerId) {
    throw ApiError.forbidden("You can only raise a grievance for your own order");
  }
  if (quote.status !== QuoteStatus.APPROVED) {
    throw ApiError.badRequest("You can only raise a grievance for a delivered order");
  }

  const existing = await prisma.grievance.findUnique({ where: { quoteId } });
  if (existing) {
    throw ApiError.conflict("A grievance has already been raised for this order");
  }

  const grievance = await prisma.grievance.create({ data: { quoteId, customerId, description } });
  return getGrievanceDetailById(grievance.id);
}

export async function resolveGrievance(grievanceId: string, customerId: string) {
  const grievance = await prisma.grievance.findUnique({ where: { id: grievanceId } });
  if (!grievance) {
    throw ApiError.notFound("Grievance not found");
  }
  if (grievance.customerId !== customerId) {
    throw ApiError.forbidden("You can only resolve your own grievance");
  }

  const result = await prisma.grievance.updateMany({
    where: { id: grievanceId, status: GrievanceStatus.OPEN },
    data: { status: GrievanceStatus.RESOLVED, resolvedAt: new Date() },
  });
  if (result.count === 0) {
    throw ApiError.conflict("This grievance's status just changed - please refresh");
  }
  return getGrievanceDetailById(grievanceId);
}

// ---------------------------------------------------------------------
// Staff-side (Manager/Admin only - enforced at the route level)
// ---------------------------------------------------------------------

export async function listAllGrievances() {
  const grievances = await prisma.grievance.findMany({
    include: { quote: { include: { customer: true } }, messages: true },
    orderBy: { createdAt: "desc" },
  });
  return grievances.map((g) => ({
    id: g.id,
    status: g.status,
    description: g.description,
    createdAt: g.createdAt,
    resolvedAt: g.resolvedAt,
    quote: { id: g.quote.id, quoteNumber: g.quote.quoteNumber },
    customer: { id: g.quote.customer.id, name: g.quote.customer.name, tier: g.quote.customer.tier },
    messageCount: g.messages.length,
  }));
}

export async function getGrievanceForStaff(id: string) {
  return getGrievanceDetailById(id);
}

// ---------------------------------------------------------------------
// Shared - posting a message (customer or staff)
// ---------------------------------------------------------------------

/**
 * Callable from either the customer-portal route (actor.role === CUSTOMER)
 * or the internal Manager/Admin route - both already restrict who reaches
 * here at all, this adds the one check neither route-level gate covers:
 * a customer may only message their OWN grievance. Blocked entirely once
 * RESOLVED - that status is the customer's own final word, not something
 * either side re-opens by just posting again.
 */
export async function addMessage(grievanceId: string, actor: Actor, message: string) {
  const grievance = await prisma.grievance.findUnique({ where: { id: grievanceId } });
  if (!grievance) {
    throw ApiError.notFound("Grievance not found");
  }
  if (actor.role === Role.CUSTOMER && grievance.customerId !== actor.customerId) {
    throw ApiError.forbidden("You can only reply to your own grievance");
  }
  if (grievance.status === GrievanceStatus.RESOLVED) {
    throw ApiError.badRequest("This grievance has already been resolved");
  }

  await prisma.grievanceMessage.create({ data: { grievanceId, userId: actor.id, message } });
  return getGrievanceDetailById(grievanceId);
}
