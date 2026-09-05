import { z } from "zod";

const percentageSchema = z
  .number()
  .min(0, "Percentage cannot be negative")
  .max(100, "Percentage cannot exceed 100");

export const createMyRequestSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid("Invalid product id"),
        quantity: z.number().int("Quantity must be a whole number").positive("Quantity must be positive"),
      })
    )
    .min(1, "Add at least one product"),
  expectedDiscountPercentage: percentageSchema.optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const negotiateQuoteSchema = z.object({
  note: z.string().trim().min(1, "Please explain what you'd like to negotiate").max(2000),
  requestedDiscountPercentage: percentageSchema.optional(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().trim().max(2000).optional(),
});

export const acceptRecommendationSchema = z.object({
  quantity: z.number().int("Quantity must be a whole number").positive("Quantity must be positive"),
  expectedDiscountPercentage: percentageSchema.optional(),
  notes: z.string().trim().max(2000).optional(),
});

export type CreateMyRequestInput = z.infer<typeof createMyRequestSchema>;
export type NegotiateQuoteInput = z.infer<typeof negotiateQuoteSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type AcceptRecommendationInput = z.infer<typeof acceptRecommendationSchema>;
