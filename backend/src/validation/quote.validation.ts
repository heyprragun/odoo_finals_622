import { z } from "zod";

const allocationInputSchema = z.object({
  warehouseId: z.string().uuid("Invalid warehouse id"),
  quantity: z.number().int("Quantity must be a whole number").positive("Quantity must be positive"),
});

export const quoteItemInputSchema = z.object({
  productId: z.string().uuid("Invalid product id"),
  quantity: z.number().int("Quantity must be a whole number").positive("Quantity must be positive"),
  // Optional - the Sales Rep's own warehouse split for this line. Omit (or
  // send an empty array) to fall back to the auto-suggested greedy split.
  allocations: z.array(allocationInputSchema).optional(),
});

// Governance (customer-tier discount ceilings, category ceilings, risk-based
// approval routing) is a future phase. For now this is just a sane input
// bound - the backend still always recalculates amounts from it.
const percentageSchema = z
  .number()
  .min(0, "Percentage cannot be negative")
  .max(100, "Percentage cannot exceed 100");

export const createQuoteSchema = z
  .object({
    customerId: z.string().uuid("Invalid customer id").optional(),
    customerRequestId: z.string().uuid("Invalid customer request id").optional(),
    notes: z.string().trim().max(2000).optional(),
    items: z.array(quoteItemInputSchema).optional(),
    discountPercentage: percentageSchema.optional(),
    taxPercentage: percentageSchema.optional(),
    // Only honored for a manually-started quote (no customerRequestId) -
    // a request-based quote's shipping location always comes from the
    // request itself (see quote.service.ts's createQuote).
    shippingLocation: z.string().trim().max(200).optional(),
  })
  .refine((data) => Boolean(data.customerId) || Boolean(data.customerRequestId), {
    message: "Either customerId or customerRequestId is required",
    path: ["customerId"],
  });

export const updateQuoteSchema = z.object({
  notes: z.string().trim().max(2000).optional(),
  items: z.array(quoteItemInputSchema),
  discountPercentage: percentageSchema.optional(),
  taxPercentage: percentageSchema.optional(),
  // Same restriction as above - ignored server-side for a request-based
  // quote, which keeps the request's own shipping location instead.
  shippingLocation: z.string().trim().max(200).optional(),
});

export const markStockUnavailableSchema = z.object({
  note: z.string().trim().min(1).max(2000).default("Order not possible"),
});

export type QuoteItemInput = z.infer<typeof quoteItemInputSchema>;
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;
export type MarkStockUnavailableInput = z.infer<typeof markStockUnavailableSchema>;
