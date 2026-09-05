import { Prisma, ProductCategory } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";
import type { CreateProductInput, UpdateProductInput } from "../validation/product.validation";

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

// Admin-only master-data management. "Removing" a product never hard-deletes
// it (it's referenced by quote items, inventory, subscriptions, etc. with
// RESTRICT foreign keys) - deactivating (active=false) is the real-world-safe
// equivalent, and the read side (search, quote-item resolution) already
// respects the active flag.

export async function createProduct(input: CreateProductInput) {
  const existing = await prisma.product.findUnique({ where: { sku: input.sku } });
  if (existing) {
    throw ApiError.conflict("A product with this SKU already exists");
  }
  return prisma.product.create({ data: input });
}

export async function updateProduct(id: string, input: UpdateProductInput) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw ApiError.notFound("Product not found");
  }
  if (input.sku && input.sku !== existing.sku) {
    const skuTaken = await prisma.product.findUnique({ where: { sku: input.sku } });
    if (skuTaken) {
      throw ApiError.conflict("A product with this SKU already exists");
    }
  }
  return prisma.product.update({ where: { id }, data: input });
}

export async function deactivateProduct(id: string) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw ApiError.notFound("Product not found");
  }
  if (!existing.active) {
    throw ApiError.badRequest("This product is already inactive");
  }
  return prisma.product.update({ where: { id }, data: { active: false } });
}
