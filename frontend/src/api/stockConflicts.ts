import { apiClient } from "./client";
import type { StockPriorityConflict } from "../types/sales";

export async function listStockConflicts(pendingOnly = true) {
  const res = await apiClient.get<{ success: true; data: StockPriorityConflict[] }>("/stock-conflicts", {
    params: { pendingOnly },
  });
  return res.data.data;
}

export async function releaseStockConflict(id: string) {
  const res = await apiClient.post<{ success: true; data: StockPriorityConflict[] }>(
    `/stock-conflicts/${id}/release`
  );
  return res.data.data;
}

export async function dismissStockConflict(id: string) {
  const res = await apiClient.post<{ success: true; data: StockPriorityConflict[] }>(
    `/stock-conflicts/${id}/dismiss`
  );
  return res.data.data;
}
