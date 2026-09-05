import type { Product, Role } from "@prisma/client";

export type SafeProduct = Omit<Product, "cost" | "unitPrice"> & {
  unitPrice: number;
  cost?: number;
};

// Only ADMIN sees product cost/margin data. Every other role (including SALES_REP)
// gets the selling price only. Revisit per-role visibility when Finance/margin
// reporting phases are implemented.
export function sanitizeProduct(product: Product, viewerRole: Role): SafeProduct {
  const { cost, unitPrice, ...rest } = product;
  return {
    ...rest,
    unitPrice: Number(unitPrice),
    ...(viewerRole === "ADMIN" ? { cost: Number(cost) } : {}),
  };
}
