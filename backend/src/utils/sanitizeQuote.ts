import type { Customer, Product, Quote, QuoteItem } from "@prisma/client";

type QuoteWithRelations = Quote & {
  customer?: Customer;
  items?: (QuoteItem & { product?: Product })[];
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

// Never includes Product.cost, even though the underlying query may have fetched it.
export function sanitizeQuote(quote: QuoteWithRelations) {
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
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
    customer: quote.customer
      ? { id: quote.customer.id, name: quote.customer.name, tier: quote.customer.tier }
      : undefined,
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
          }
        : undefined,
    })),
  };
}
