import { apiClient } from "./client";
import type { WarehouseAvailability } from "../types/sales";

export async function getProductAvailability(productId: string) {
  const res = await apiClient.get<{ success: true; data: WarehouseAvailability[] }>(
    `/inventory/product/${productId}`
  );
  return res.data.data;
}
