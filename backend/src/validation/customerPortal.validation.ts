import { z } from "zod";

const percentageSchema = z
  .number()
  .min(0, "Percentage cannot be negative")
  .max(100, "Percentage cannot exceed 100");

const billingCycleSchema = z.enum(["MONTHLY", "QUARTERLY", "ANNUALLY"]);

export const createMyRequestSchema = z
  .object({
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
    // Set from the portal's "Recurring Plans" tab - when true, every item on
    // this request should be billed on billingCycle rather than as a
    // one-time order (see quote.service.ts's createQuote).
    isRecurring: z.boolean().optional(),
    billingCycle: billingCycleSchema.optional(),
    // Set from the portal's "Change Subscription Plan" action instead -
    // customerPortal.service.ts's createMyRequest forces items/isRecurring
    // to match the referenced subscription exactly (only the billing cycle
    // may differ), so this is mutually exclusive with a customer freely
    // picking their own items.
    modifiesSubscriptionId: z.string().uuid("Invalid subscription id").optional(),
    // Where this order should ship - optional at the API level (a plan
    // change, say, doesn't collect one), but the "Create New Request"/
    // "Recurring Plans" forms make it a required field of their own since
    // it's what drives the Groq-assisted cost-optimized warehouse split in
    // inventory.service.ts's suggestStockAllocation.
    shippingLocation: z.string().trim().max(300).optional(),
  })
  .refine((data) => !data.isRecurring || Boolean(data.billingCycle), {
    message: "A billing cycle is required for a recurring request",
    path: ["billingCycle"],
  });

export const negotiateQuoteSchema = z.object({
  note: z.string().trim().min(1, "Please explain what you'd like to negotiate").max(2000),
  requestedDiscountPercentage: percentageSchema.optional(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().trim().max(2000).optional(),
});

export const cancelSubscriptionSchema = z.object({
  reason: z.string().trim().max(2000).optional(),
});

export const acceptRecommendationSchema = z.object({
  quantity: z.number().int("Quantity must be a whole number").positive("Quantity must be positive"),
  expectedDiscountPercentage: percentageSchema.optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const requestTierChangeSchema = z.object({
  requestedTier: z.enum(["GOLD", "SILVER", "BRONZE"]),
  note: z.string().trim().max(2000).optional(),
});

export const resolveDiscountReviewSchema = z.object({
  newExpectedDiscountPercentage: percentageSchema,
  note: z.string().trim().max(2000).optional(),
});

export type CreateMyRequestInput = z.infer<typeof createMyRequestSchema>;
export type NegotiateQuoteInput = z.infer<typeof negotiateQuoteSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>;
export type AcceptRecommendationInput = z.infer<typeof acceptRecommendationSchema>;
export type RequestTierChangeInput = z.infer<typeof requestTierChangeSchema>;
export type ResolveDiscountReviewInput = z.infer<typeof resolveDiscountReviewSchema>;
