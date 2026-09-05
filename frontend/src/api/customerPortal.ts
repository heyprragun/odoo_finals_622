import { apiClient } from "./client";
import type {
  CustomerInvoicesResponse,
  CustomerOrder,
  CustomerOrderDetail,
  CustomerSubscriptionItem,
  NegotiableQuote,
  QuoteItemInput,
} from "../types/sales";

export interface CreateMyRequestPayload {
  items: QuoteItemInput[];
  expectedDiscountPercentage?: number;
  notes?: string;
}

export interface NegotiateQuotePayload {
  note: string;
  requestedDiscountPercentage?: number;
}

export interface AcceptRecommendationPayload {
  quantity: number;
  expectedDiscountPercentage?: number;
  notes?: string;
}

export async function listMyOrders() {
  const res = await apiClient.get<{ success: true; data: CustomerOrder[] }>("/portal/orders");
  return res.data.data;
}

export async function getMyOrder(id: string) {
  const res = await apiClient.get<{ success: true; data: CustomerOrderDetail }>(`/portal/orders/${id}`);
  return res.data.data;
}

export async function cancelMyOrder(id: string, reason?: string) {
  const res = await apiClient.post<{ success: true; data: CustomerOrderDetail }>(
    `/portal/orders/${id}/cancel`,
    { reason }
  );
  return res.data.data;
}

export async function listMySubscriptions() {
  const res = await apiClient.get<{ success: true; data: CustomerSubscriptionItem[] }>(
    "/portal/subscriptions"
  );
  return res.data.data;
}

export async function listMyInvoices() {
  const res = await apiClient.get<{ success: true; data: CustomerInvoicesResponse }>("/portal/invoices");
  return res.data.data;
}

export async function createMyRequest(payload: CreateMyRequestPayload) {
  const res = await apiClient.post<{ success: true; data: unknown }>("/portal/requests", payload);
  return res.data.data;
}

export async function listMyNegotiableQuotes() {
  const res = await apiClient.get<{ success: true; data: NegotiableQuote[] }>("/portal/negotiations");
  return res.data.data;
}

export async function negotiateQuote(quoteId: string, payload: NegotiateQuotePayload) {
  const res = await apiClient.post<{ success: true; data: NegotiableQuote }>(
    `/portal/negotiations/${quoteId}`,
    payload
  );
  return res.data.data;
}

export async function acceptRecommendation(recommendationId: string, payload: AcceptRecommendationPayload) {
  const res = await apiClient.post<{ success: true; data: unknown }>(
    `/portal/recommendations/${recommendationId}/accept`,
    payload
  );
  return res.data.data;
}

export async function declineRecommendation(recommendationId: string) {
  const res = await apiClient.post<{ success: true; data: { declined: true } }>(
    `/portal/recommendations/${recommendationId}/decline`
  );
  return res.data.data;
}
