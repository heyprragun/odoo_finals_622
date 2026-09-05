import { z } from "zod";

export const quoteItemInputSchema = z.object({
  productId: z.string().uuid("Invalid product id"),
  quantity: z.number().int("Quantity must be a whole number").positive("Quantity must be positive"),
});

export const createQuoteSchema = z
  .object({
    customerId: z.string().uuid("Invalid customer id").optional(),
    customerRequestId: z.string().uuid("Invalid customer request id").optional(),
    notes: z.string().trim().max(2000).optional(),
    items: z.array(quoteItemInputSchema).optional(),
  })
  .refine((data) => Boolean(data.customerId) || Boolean(data.customerRequestId), {
    message: "Either customerId or customerRequestId is required",
    path: ["customerId"],
  });

export const updateQuoteSchema = z.object({
  notes: z.string().trim().max(2000).optional(),
  items: z.array(quoteItemInputSchema),
});

export type QuoteItemInput = z.infer<typeof quoteItemInputSchema>;
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;
