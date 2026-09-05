import { z } from "zod";
import { CustomerTier, ProductCategory } from "@prisma/client";

const percentageSchema = z.number().min(0, "Cannot be negative").max(100, "Cannot exceed 100");

export const updateGovernanceSettingsSchema = z.object({
  categoryLimits: z
    .array(
      z.object({
        category: z.nativeEnum(ProductCategory),
        maxDiscountPercentage: percentageSchema,
      })
    )
    .min(1),
  tierLimits: z
    .array(
      z.object({
        tier: z.nativeEnum(CustomerTier),
        maxDiscountPercentage: percentageSchema,
      })
    )
    .min(1),
  riskSettings: z.object({
    highRiskOverByThreshold: percentageSchema,
    highRiskBreachCountMin: z.number().int("Must be a whole number").min(1, "Must be at least 1"),
  }),
});

export type UpdateGovernanceSettingsInput = z.infer<typeof updateGovernanceSettingsSchema>;
