import { apiClient } from "./client";
import type { StockAllocationResult, StockSummaryItem, WarehouseAvailability } from "../types/sales";

export async function getProductAvailability(productId: string) {
  const res = await apiClient.get<{ success: true; data: WarehouseAvailability[] }>(
    `/inventory/product/${productId}`
  );
  return res.data.data;
}

export async function getStockAllocation(
  productId: string,
  quantity: number,
  excludeQuoteItemId?: string,
  destinationLocation?: string
) {
  const res = await apiClient.get<{ success: true; data: StockAllocationResult }>(
    `/inventory/product/${productId}/allocation`,
    { params: { quantity, excludeQuoteItemId, destinationLocation } }
  );
  return res.data.data;
}

export async function getStockSummary() {
  const res = await apiClient.get<{ success: true; data: StockSummaryItem[] }>("/inventory");
  return res.data.data;
}

// Admin-only stock write - the backend enforces this regardless of what the
// frontend shows.
export async function updateInventoryForProduct(
  productId: string,
  entries: { warehouseId: string; quantityAvailable: number }[]
) {
  const res = await apiClient.put<{ success: true; data: WarehouseAvailability[] }>(
    `/inventory/product/${productId}`,
    { entries }
  );
  return res.data.data;
}
