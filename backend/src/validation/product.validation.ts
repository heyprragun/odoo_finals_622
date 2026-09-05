import { z } from "zod";
import { ProductCategory } from "@prisma/client";

export const createProductSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  sku: z.string().trim().min(1, "SKU is required"),
  category: z.nativeEnum(ProductCategory, {
    errorMap: () => ({ message: `Category must be one of: ${Object.values(ProductCategory).join(", ")}` }),
  }),
  description: z.string().trim().max(2000).optional(),
  unitPrice: z.number().min(0, "Selling price cannot be negative"),
  cost: z.number().min(0, "Cost cannot be negative"),
});

export const updateProductSchema = z.object({
  name: z.string().trim().min(1, "Name is required").optional(),
  sku: z.string().trim().min(1, "SKU is required").optional(),
  category: z.nativeEnum(ProductCategory).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  unitPrice: z.number().min(0, "Selling price cannot be negative").optional(),
  cost: z.number().min(0, "Cost cannot be negative").optional(),
  active: z.boolean().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
