import type {
  Customer,
  DiscountReviewStatus,
  Product,
  Quote,
  QuoteItem,
  QuoteItemAllocation,
  Role,
  User,
  Warehouse,
} from "@prisma/client";

type QuoteWithRelations = Quote & {
  customer?: Customer;
  items?: (QuoteItem & {
    product?: Product;
    allocations?: (QuoteItemAllocation & { warehouse: Warehouse })[];
  })[];
  customerRequest?: {
    expectedDiscountPercentage: unknown;
    proposedDiscountPercentage: unknown;
    discountReviewStatus: DiscountReviewStatus;
  } | null;
  // Pre-filtered to the single latest NUDGED entry (see quote.service.ts's
  // QUOTE_INCLUDE) - not the full audit trail.
  auditEntries?: { note: string | null; createdAt: Date; user: User }[];
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

// Only ADMIN sees product cost/margin data, matching sanitizeProduct.ts's
// exact rule - Product.cost is fetched as part of QUOTE_INCLUDE's `product:
// true` (needed for nothing else), so it MUST be stripped for every other
// viewer, same as sanitizeProduct does for the plain catalog endpoints.
export function sanitizeQuote(quote: QuoteWithRelations, viewerRole?: Role) {
  const includeCost = viewerRole === "ADMIN";
  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    customerId: quote.customerId,
    salesRepId: quote.salesRepId,
    customerRequestId: quote.customerRequestId,
    status: quote.status,
    riskLevel: quote.riskLevel,
    subtotal: toNumber(quote.subtotal),
    discountPercentage: toNumber(quote.discountPercentage),
    taxPercentage: toNumber(quote.taxPercentage),
    discountAmount: toNumber(quote.discountAmount),
    taxAmount: toNumber(quote.taxAmount),
    totalAmount: toNumber(quote.totalAmount),
    notes: quote.notes,
    isRecurring: quote.isRecurring,
    billingCycle: quote.billingCycle,
    shippingLocation: quote.shippingLocation,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
    customer: quote.customer
      ? { id: quote.customer.id, name: quote.customer.name, tier: quote.customer.tier }
      : undefined,
    // Lets the Sales Rep see what the customer expects and whether their
    // last submit attempt got flagged for offering less than that.
    customerRequestDiscountReview: quote.customerRequest
      ? {
          expectedDiscountPercentage: toNumber(quote.customerRequest.expectedDiscountPercentage),
          proposedDiscountPercentage: toNumber(quote.customerRequest.proposedDiscountPercentage),
          status: quote.customerRequest.discountReviewStatus,
        }
      : null,
    // Only shown while still "unread" - a Manager/Admin nudge that predates
    // the quote's own last update means the Rep has already acted since.
    pendingNudge: (() => {
      const nudge = quote.auditEntries?.[0];
      if (!nudge || nudge.createdAt <= quote.updatedAt) return null;
      return { note: nudge.note, fromUserName: nudge.user.name, createdAt: nudge.createdAt };
    })(),
    items: quote.items?.map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: toNumber(item.unitPrice),
      lineTotal: toNumber(item.lineTotal),
      product: item.product
        ? {
            id: item.product.id,
            name: item.product.name,
            sku: item.product.sku,
            category: item.product.category,
            ...(includeCost ? { cost: toNumber(item.product.cost) } : {}),
          }
        : undefined,
      allocations: item.allocations?.map((alloc) => ({
        warehouseId: alloc.warehouseId,
        warehouseName: alloc.warehouse.name,
        location: alloc.warehouse.location,
        quantity: alloc.quantity,
        estimatedShippingCost: toNumber(alloc.estimatedShippingCost),
      })),
    })),
  };
}
