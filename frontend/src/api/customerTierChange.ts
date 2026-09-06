import { apiClient } from "./client";
import type { PendingTierChangeRequest } from "../types/sales";

// Admin-only - the backend enforces this regardless of what the frontend shows.
export async function listTierChangeRequests() {
  const res = await apiClient.get<{ success: true; data: PendingTierChangeRequest[] }>(
    "/customer-tier-change-requests"
  );
  return res.data.data;
}

export async function decideTierChangeRequest(id: string, decision: "APPROVE" | "REJECT", note?: string) {
  const res = await apiClient.post<{ success: true; data: PendingTierChangeRequest[] }>(
    `/customer-tier-change-requests/${id}/decide`,
    { decision, note }
  );
  return res.data.data;
}
