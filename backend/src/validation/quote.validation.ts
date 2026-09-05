import { z } from "zod";

export const quoteItemInputSchema = z.object({
  productId: z.string().uuid("Invalid product id"),
  quantity: z.number().int("Quantity must be a whole number").positive("Quantity must be positive"),
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
});

export type QuoteItemInput = z.infer<typeof quoteItemInputSchema>;
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;
