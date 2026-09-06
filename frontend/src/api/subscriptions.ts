import { apiClient } from "./client";
import type { CompanySubscriptionDetail, SubscriptionListItem, SubscriptionsSummary } from "../types/sales";

export interface SubscriptionsListResponse {
  summary: SubscriptionsSummary;
  items: SubscriptionListItem[];
}

export async function listSubscriptions() {
  const res = await apiClient.get<{ success: true; data: SubscriptionsListResponse }>(
    "/subscriptions"
  );
  return res.data.data;
}

export async function getCompanySubscriptionDetail(customerId: string) {
  const res = await apiClient.get<{ success: true; data: CompanySubscriptionDetail }>(
    `/subscriptions/company/${customerId}`
  );
  return res.data.data;
}

export async function pauseSubscription(id: string, note?: string) {
  const res = await apiClient.post<{ success: true; data: CompanySubscriptionDetail }>(
    `/subscriptions/${id}/pause`,
    { note }
  );
  return res.data.data;
}

export async function resumeSubscription(id: string, note?: string) {
  const res = await apiClient.post<{ success: true; data: CompanySubscriptionDetail }>(
    `/subscriptions/${id}/resume`,
    { note }
  );
  return res.data.data;
}

export async function cancelSubscription(id: string, note?: string) {
  const res = await apiClient.post<{ success: true; data: CompanySubscriptionDetail }>(
    `/subscriptions/${id}/cancel`,
    { note }
  );
  return res.data.data;
}

export async function changeSubscriptionQuantity(id: string, quantity: number) {
  const res = await apiClient.post<{ success: true; data: CompanySubscriptionDetail }>(
    `/subscriptions/${id}/change-quantity`,
    { quantity }
  );
  return res.data.data;
}
