import { apiClient } from "./client";
import type { Product } from "../types/sales";

export interface ProductSearchParams {
  search?: string;
  category?: string;
}

// Kept as a thin wrapper so a future AI/semantic search mode can be swapped in
// behind this same function signature without touching callers.
export async function searchProducts(params: ProductSearchParams) {
  const res = await apiClient.get<{ success: true; data: Product[] }>("/products", { params });
  return res.data.data;
}
