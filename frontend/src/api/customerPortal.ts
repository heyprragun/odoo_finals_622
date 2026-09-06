import { apiClient } from "./client";
import type {
  BillingCycle,
  CustomerInvoicesResponse,
  CustomerNavAlerts,
  CustomerOrder,
  CustomerOrderDetail,
  CustomerSubscriptionDetail,
  CustomerSubscriptionItem,
  CustomerTier,
  DeliveredOrder,
  DiscountReview,
  GrievanceDetail,
  MyTierChangeInfo,
  NegotiableQuote,
  QuoteItemInput,
} from "../types/sales";

export interface CreateMyRequestPayload {
  items: QuoteItemInput[];
  expectedDiscountPercentage?: number;
  notes?: string;
  // Set from the "Recurring Plans" tab - when true, billingCycle is required.
  isRecurring?: boolean;
  billingCycle?: BillingCycle;
  // Set from a subscription's "Change Plan" action instead - see
  // CreateMyRequestSchema on the backend for the constraints this implies.
  modifiesSubscriptionId?: string;
  // Where this order should ship - drives the Groq-assisted cost-optimized
  // warehouse split (see inventory.service.ts's suggestStockAllocation).
  shippingLocation?: string;
}

export interface RequestTierChangePayload {
  requestedTier: CustomerTier;
  note?: string;
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

export async function getMySubscription(id: string) {
  const res = await apiClient.get<{ success: true; data: CustomerSubscriptionDetail }>(
    `/portal/subscriptions/${id}`
  );
  return res.data.data;
}

export async function cancelMySubscription(id: string, reason?: string) {
  const res = await apiClient.post<{ success: true; data: CustomerSubscriptionDetail }>(
    `/portal/subscriptions/${id}/cancel`,
    { reason }
  );
  return res.data.data;
}

export async function getMyTierChangeInfo() {
  const res = await apiClient.get<{ success: true; data: MyTierChangeInfo }>("/portal/tier-change-requests");
  return res.data.data;
}

export async function requestTierChange(payload: RequestTierChangePayload) {
  const res = await apiClient.post<{ success: true; data: MyTierChangeInfo }>(
    "/portal/tier-change-requests",
    payload
  );
  return res.data.data;
}

export async function listMyInvoices() {
  const res = await apiClient.get<{ success: true; data: CustomerInvoicesResponse }>("/portal/invoices");
  return res.data.data;
}

export async function downloadMyInvoicePdf(id: string, filename: string) {
  const res = await apiClient.get(`/portal/invoices/${id}/pdf`, { responseType: "blob" });
  const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
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

export async function getCustomerNavAlerts() {
  const res = await apiClient.get<{ success: true; data: CustomerNavAlerts }>("/portal/nav-alerts");
  return res.data.data;
}

export async function listMyDiscountReviews() {
  const res = await apiClient.get<{ success: true; data: DiscountReview[] }>("/portal/discount-reviews");
  return res.data.data;
}

export async function resolveDiscountReview(
  requestId: string,
  newExpectedDiscountPercentage: number,
  note?: string
) {
  const res = await apiClient.post<{ success: true; data: DiscountReview[] }>(
    `/portal/discount-reviews/${requestId}/resolve`,
    { newExpectedDiscountPercentage, note }
  );
  return res.data.data;
}

export async function listMyDeliveredOrders() {
  const res = await apiClient.get<{ success: true; data: DeliveredOrder[] }>("/portal/delivered-orders");
  return res.data.data;
}

export async function getMyGrievanceByOrder(quoteId: string) {
  const res = await apiClient.get<{ success: true; data: GrievanceDetail | null }>(
    `/portal/grievances/order/${quoteId}`
  );
  return res.data.data;
}

export async function createGrievance(quoteId: string, description: string) {
  const res = await apiClient.post<{ success: true; data: GrievanceDetail }>("/portal/grievances", {
    quoteId,
    description,
  });
  return res.data.data;
}

export async function addMyGrievanceMessage(id: string, message: string) {
  const res = await apiClient.post<{ success: true; data: GrievanceDetail }>(`/portal/grievances/${id}/messages`, {
    message,
  });
  return res.data.data;
}

export async function resolveMyGrievance(id: string) {
  const res = await apiClient.post<{ success: true; data: GrievanceDetail }>(`/portal/grievances/${id}/resolve`);
  return res.data.data;
}
