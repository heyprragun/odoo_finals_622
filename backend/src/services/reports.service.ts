import { Prisma, QuoteAuditAction, QuoteStatus, Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";
import { getCompanySubscriptionDetail } from "./subscription.service";

const PENDING_STATUSES: QuoteStatus[] = [
  QuoteStatus.PENDING_MANAGER_APPROVAL,
  QuoteStatus.PENDING_FINANCE_APPROVAL,
  QuoteStatus.PENDING_ADMIN_APPROVAL,
];

// --- Team directory & performance ---

export async function getTeamDirectory() {
  const users = await prisma.user.findMany({
    where: { role: { in: [Role.SALES_REP, Role.MANAGER, Role.FINANCE] } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  const [ownedGroups, actionGroups] = await Promise.all([
    prisma.quote.groupBy({ by: ["salesRepId", "status"], _count: { _all: true } }),
    prisma.quoteAuditEntry.groupBy({ by: ["userId", "action"], _count: { _all: true } }),
  ]);

  const ownedByUser = new Map<
    string,
    { total: number; approved: number; rejected: number; pending: number }
  >();
  for (const row of ownedGroups) {
    const entry = ownedByUser.get(row.salesRepId) ?? { total: 0, approved: 0, rejected: 0, pending: 0 };
    entry.total += row._count._all;
    if (row.status === QuoteStatus.APPROVED) entry.approved += row._count._all;
    else if (row.status === QuoteStatus.REJECTED) entry.rejected += row._count._all;
    else if (PENDING_STATUSES.includes(row.status)) entry.pending += row._count._all;
    ownedByUser.set(row.salesRepId, entry);
  }

  const actionsByUser = new Map<string, { approved: number; returned: number; rejected: number }>();
  for (const row of actionGroups) {
    const entry = actionsByUser.get(row.userId) ?? { approved: 0, returned: 0, rejected: 0 };
    if (row.action === QuoteAuditAction.APPROVED) entry.approved += row._count._all;
    else if (row.action === QuoteAuditAction.RETURNED) entry.returned += row._count._all;
    else if (row.action === QuoteAuditAction.REJECTED) entry.rejected += row._count._all;
    actionsByUser.set(row.userId, entry);
  }

  return users.map((user) => {
    const owned = ownedByUser.get(user.id) ?? { total: 0, approved: 0, rejected: 0, pending: 0 };
    const actions = actionsByUser.get(user.id) ?? { approved: 0, returned: 0, rejected: 0 };
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      // Relevant for Sales Reps - the deals they personally own.
      ownedQuotesTotal: owned.total,
      ownedQuotesApproved: owned.approved,
      ownedQuotesRejected: owned.rejected,
      ownedQuotesPending: owned.pending,
      // Relevant for Managers/Finance - their throughput as approvers.
      approvalsGiven: actions.approved,
      returnsGiven: actions.returned,
      rejectionsGiven: actions.rejected,
    };
  });
}

// --- Company-wide quotations: date range + status-bucket filtering ---

export type QuotationBucket =
  | "PENDING_MANAGER"
  | "PENDING_FINANCE"
  | "PENDING_ADMIN"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "DRAFT_OR_REVISION";

function bucketForStatus(status: QuoteStatus): QuotationBucket {
  switch (status) {
    case QuoteStatus.PENDING_MANAGER_APPROVAL:
      return "PENDING_MANAGER";
    case QuoteStatus.PENDING_FINANCE_APPROVAL:
      return "PENDING_FINANCE";
    case QuoteStatus.PENDING_ADMIN_APPROVAL:
      return "PENDING_ADMIN";
    case QuoteStatus.APPROVED:
      return "APPROVED";
    case QuoteStatus.REJECTED:
      return "REJECTED";
    case QuoteStatus.CANCELLED:
      return "CANCELLED";
    default:
      // DRAFT, legacy SUBMITTED, REVISION_REQUIRED - not yet (re)submitted.
      return "DRAFT_OR_REVISION";
  }
}

export interface QuotationsFilter {
  from?: Date;
  to?: Date;
  bucket?: QuotationBucket;
}

export async function getOrdersOverview(filter: QuotationsFilter) {
  const where: Prisma.QuoteWhereInput = {};
  if (filter.from || filter.to) {
    where.createdAt = {
      ...(filter.from ? { gte: filter.from } : {}),
      ...(filter.to ? { lte: filter.to } : {}),
    };
  }

  const quotes = await prisma.quote.findMany({
    where,
    include: { customer: true, salesRep: true, items: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
  });

  const formatted = quotes.map((quote) => ({
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    customerName: quote.customer.name,
    salesRepName: quote.salesRep.name,
    status: quote.status,
    bucket: bucketForStatus(quote.status),
    totalAmount: Number(quote.totalAmount),
    itemSummary: quote.items.map((item) => `${item.product.name} (x${item.quantity})`).join(", "),
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
  }));

  const summary = {
    pendingManager: formatted.filter((q) => q.bucket === "PENDING_MANAGER").length,
    pendingFinance: formatted.filter((q) => q.bucket === "PENDING_FINANCE").length,
    pendingAdmin: formatted.filter((q) => q.bucket === "PENDING_ADMIN").length,
    approved: formatted.filter((q) => q.bucket === "APPROVED").length,
    rejected: formatted.filter((q) => q.bucket === "REJECTED").length,
    cancelled: formatted.filter((q) => q.bucket === "CANCELLED").length,
    draftOrRevision: formatted.filter((q) => q.bucket === "DRAFT_OR_REVISION").length,
  };

  return {
    summary,
    items: filter.bucket ? formatted.filter((q) => q.bucket === filter.bucket) : formatted,
    // Kept as dedicated groupings for the specific "under review" / "to be
    // shipped" framing - both are just views over the same date-filtered
    // set above (no SHIPPED status exists yet, so "to be shipped" is every
    // APPROVED order - fulfillment's responsibility from here).
    underReview: formatted.filter((q) =>
      (["PENDING_MANAGER", "PENDING_FINANCE", "PENDING_ADMIN"] as QuotationBucket[]).includes(q.bucket)
    ),
    toBeShipped: formatted.filter((q) => q.bucket === "APPROVED"),
  };
}

// --- Product sales performance ---

export interface ProductPerformanceRow {
  productId: string;
  name: string;
  sku: string;
  category: string;
  unitsSold: number;
  revenue: number;
  averageDiscountPercentage: number;
}

export async function getProductPerformance() {
  const products = await prisma.product.findMany({ where: { active: true } });
  const items = await prisma.quoteItem.findMany({
    where: { quote: { status: QuoteStatus.APPROVED } },
    include: { quote: { select: { discountPercentage: true } } },
  });

  const byProduct = new Map(
    products.map((p) => [
      p.id,
      {
        productId: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category as string,
        unitsSold: 0,
        revenue: new Prisma.Decimal(0),
        discountWeightedSum: new Prisma.Decimal(0),
      },
    ])
  );

  for (const item of items) {
    const entry = byProduct.get(item.productId);
    if (!entry) continue; // product since deactivated
    entry.unitsSold += item.quantity;
    entry.revenue = entry.revenue.add(item.lineTotal);
    entry.discountWeightedSum = entry.discountWeightedSum.add(item.quote.discountPercentage.mul(item.quantity));
  }

  const rows: ProductPerformanceRow[] = [...byProduct.values()].map((entry) => ({
    productId: entry.productId,
    name: entry.name,
    sku: entry.sku,
    category: entry.category,
    unitsSold: entry.unitsSold,
    revenue: Number(entry.revenue),
    averageDiscountPercentage:
      entry.unitsSold > 0 ? Number(entry.discountWeightedSum.div(entry.unitsSold)) : 0,
  }));

  return {
    all: rows,
    bestSelling: [...rows].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 5),
    leastSelling: [...rows].sort((a, b) => a.unitsSold - b.unitsSold).slice(0, 5),
    mostDiscounted: [...rows]
      .filter((r) => r.unitsSold > 0)
      .sort((a, b) => b.averageDiscountPercentage - a.averageDiscountPercentage)
      .slice(0, 5),
  };
}

// --- Customer tier overview & drill-down ---

const TIER_ORDER = ["GOLD", "SILVER", "BRONZE"];

export async function getCustomerTierOverview() {
  const customers = await prisma.customer.findMany({
    include: {
      quotes: { where: { status: QuoteStatus.APPROVED }, select: { totalAmount: true } },
      subscriptions: { where: { status: "ACTIVE" }, select: { id: true } },
      customerRequests: { select: { id: true } },
    },
  });

  const rows = customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    tier: customer.tier,
    totalOrders: customer.customerRequests.length,
    totalApprovedSpend: customer.quotes.reduce((sum, q) => sum + Number(q.totalAmount), 0),
    activeSubscriptions: customer.subscriptions.length,
  }));

  return rows.sort((a, b) => {
    const tierDiff = TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier);
    return tierDiff !== 0 ? tierDiff : a.name.localeCompare(b.name);
  });
}

export async function getCustomerDetail(customerId: string) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    throw ApiError.notFound("Customer not found");
  }

  const [subscriptionDetail, invoices, requests, changeRequests] = await Promise.all([
    getCompanySubscriptionDetail(customerId),
    prisma.invoice.findMany({ where: { customerId }, orderBy: { issuedDate: "desc" } }),
    prisma.customerRequest.findMany({
      where: { customerId },
      include: {
        items: { include: { product: true } },
        quote: { select: { id: true, quoteNumber: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.customerTierChangeRequest.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    customer: { id: customer.id, name: customer.name, tier: customer.tier },
    subscriptions: subscriptionDetail.subscriptions,
    oneTimeOrders: subscriptionDetail.oneTimeOrders,
    recurringOrders: subscriptionDetail.recurringOrders,
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount: Number(invoice.amount),
      status: invoice.status,
      issuedDate: invoice.issuedDate,
      dueDate: invoice.dueDate,
      paidAt: invoice.paidAt,
    })),
    previousOrders: requests.map((request) => ({
      id: request.id,
      status: request.status,
      createdAt: request.createdAt,
      items: request.items.map((item) => ({ productName: item.product.name, quantity: item.requestedQuantity })),
      quote: request.quote
        ? { id: request.quote.id, quoteNumber: request.quote.quoteNumber, status: request.quote.status }
        : null,
    })),
    // Customer-initiated plan tier (Gold/Silver/Bronze) upgrade/downgrade
    // requests (portal's "Upgrade Subscription" tab) - Admin decides these
    // via /api/customer-tier-change-requests, not from here; this is a
    // read-only view.
    tierChangeRequests: changeRequests.map((request) => ({
      id: request.id,
      requestedTier: request.requestedTier,
      type: request.type,
      status: request.status,
      customerNote: request.customerNote,
      adminNote: request.adminNote,
      createdAt: request.createdAt,
      decidedAt: request.decidedAt,
    })),
  };
}

export async function getReportSummary() {
  const [team, orders, products, customers] = await Promise.all([
    getTeamDirectory(),
    getOrdersOverview({}),
    getProductPerformance(),
    getCustomerTierOverview(),
  ]);
  return { generatedAt: new Date(), team, orders, products, customers };
}
