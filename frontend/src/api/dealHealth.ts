import { apiClient } from "./client";
import type { DealHealthDetail, DealHealthOverview } from "../types/sales";

export async function getDealHealthOverview() {
  const res = await apiClient.get<{ success: true; data: DealHealthOverview }>("/deal-health");
  return res.data.data;
}

export async function getDealHealthDetail(quoteId: string) {
  const res = await apiClient.get<{ success: true; data: DealHealthDetail }>(`/deal-health/${quoteId}`);
  return res.data.data;
}

export async function rejectFlaggedDeal(quoteId: string, note: string) {
  const res = await apiClient.post<{ success: true; data: DealHealthDetail }>(
    `/deal-health/${quoteId}/reject`,
    { note }
  );
  return res.data.data;
}

export async function nudgeSalesRep(quoteId: string, note: string) {
  const res = await apiClient.post<{ success: true; data: DealHealthDetail }>(
    `/deal-health/${quoteId}/nudge`,
    { note }
  );
  return res.data.data;
}
