import { Prisma, ProductCategory } from "@prisma/client";
import { prisma } from "../config/prisma";

export interface ProductSearchParams {
  search?: string;
  category?: string;
  activeOnly?: boolean;
}

const CATEGORY_VALUES = Object.values(ProductCategory) as string[];

/**
 * Keyword product search (name / SKU / category). Kept behind this service
 * boundary so a future ProductSearchService (semantic/AI/hybrid) can wrap or
 * replace this without touching controllers or the frontend.
 */
export async function searchProducts({
  search,
  category,
  activeOnly = true,
}: ProductSearchParams) {
  const and: Prisma.ProductWhereInput[] = [];

  if (activeOnly) {
    and.push({ active: true });
  }

  if (category) {
    const normalized = category.toUpperCase();
    if (CATEGORY_VALUES.includes(normalized)) {
      and.push({ category: normalized as ProductCategory });
    } else {
      and.push({ id: "__no_match__" });
    }
  }

  if (search) {
    const term = search.trim();
    const orConditions: Prisma.ProductWhereInput[] = [
      { name: { contains: term, mode: "insensitive" } },
      { sku: { contains: term, mode: "insensitive" } },
    ];
    const normalizedTerm = term.toUpperCase();
    if (CATEGORY_VALUES.includes(normalizedTerm)) {
      orConditions.push({ category: normalizedTerm as ProductCategory });
    }
    and.push({ OR: orConditions });
  }

  return prisma.product.findMany({
    where: and.length > 0 ? { AND: and } : undefined,
    orderBy: { name: "asc" },
  });
}

export async function getProductById(id: string) {
  return prisma.product.findUnique({ where: { id } });
}
