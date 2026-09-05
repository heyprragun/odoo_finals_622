import { apiClient } from "./client";
import type { Product, ProductCategory } from "../types/sales";

export interface ProductSearchParams {
  search?: string;
  category?: string;
  includeInactive?: boolean;
}

export interface ProductInput {
  name: string;
  sku: string;
  category: ProductCategory;
  description?: string;
  unitPrice: number;
  cost: number;
}

// Kept as a thin wrapper so a future AI/semantic search mode can be swapped in
// behind this same function signature without touching callers.
export async function searchProducts(params: ProductSearchParams) {
  const res = await apiClient.get<{ success: true; data: Product[] }>("/products", {
    params: { ...params, includeInactive: params.includeInactive ? "true" : undefined },
  });
  return res.data.data;
}

export async function getProduct(id: string) {
  const res = await apiClient.get<{ success: true; data: Product }>(`/products/${id}`);
  return res.data.data;
}

// Admin-only master-data management - the backend enforces this
// regardless of what the frontend shows.
export async function createProduct(input: ProductInput) {
  const res = await apiClient.post<{ success: true; data: Product }>("/products", input);
  return res.data.data;
}

export async function updateProduct(id: string, input: Partial<ProductInput & { active: boolean }>) {
  const res = await apiClient.put<{ success: true; data: Product }>(`/products/${id}`, input);
  return res.data.data;
}

export async function deactivateProduct(id: string) {
  const res = await apiClient.delete<{ success: true; data: Product }>(`/products/${id}`);
  return res.data.data;
}
