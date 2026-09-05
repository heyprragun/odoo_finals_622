import { apiClient } from "./client";
import type { ApprovalDetail, ApprovalListItem, ApprovalSummary } from "../types/sales";

export interface ApprovalsListResponse {
  summary: ApprovalSummary;
  items: ApprovalListItem[];
}

export async function listApprovals(pendingOnly: boolean) {
  const res = await apiClient.get<{ success: true; data: ApprovalsListResponse }>("/approvals", {
    params: pendingOnly ? { pendingOnly: "true" } : undefined,
  });
  return res.data.data;
}

export async function getApprovalDetail(id: string) {
  const res = await apiClient.get<{ success: true; data: ApprovalDetail }>(`/approvals/${id}`);
  return res.data.data;
}

export async function approveQuoteApproval(id: string, note?: string) {
  const res = await apiClient.post<{ success: true; data: ApprovalDetail }>(`/approvals/${id}/approve`, {
    note,
  });
  return res.data.data;
}

export async function returnQuoteForRevision(id: string, note: string) {
  const res = await apiClient.post<{ success: true; data: ApprovalDetail }>(`/approvals/${id}/return`, {
    note,
  });
  return res.data.data;
}

export async function rejectQuoteApproval(id: string, note: string) {
  const res = await apiClient.post<{ success: true; data: ApprovalDetail }>(`/approvals/${id}/reject`, {
    note,
  });
  return res.data.data;
}
