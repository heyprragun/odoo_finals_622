import { apiClient } from "./client";
import type { Quote, QuoteItemInput } from "../types/sales";

export interface CreateQuotePayload {
  customerId?: string;
  customerRequestId?: string;
  notes?: string;
  items?: QuoteItemInput[];
  discountPercentage?: number;
  taxPercentage?: number;
  shippingLocation?: string;
}

export interface UpdateQuotePayload {
  notes?: string;
  items: QuoteItemInput[];
  discountPercentage?: number;
  taxPercentage?: number;
  shippingLocation?: string;
}

export async function listMyQuotes() {
  const res = await apiClient.get<{ success: true; data: Quote[] }>("/quotes");
  return res.data.data;
}

export async function getQuote(id: string) {
  const res = await apiClient.get<{ success: true; data: Quote }>(`/quotes/${id}`);
  return res.data.data;
}

export async function createQuote(payload: CreateQuotePayload) {
  const res = await apiClient.post<{ success: true; data: Quote }>("/quotes", payload);
  return res.data.data;
}

export async function updateQuote(id: string, payload: UpdateQuotePayload) {
  const res = await apiClient.put<{ success: true; data: Quote }>(`/quotes/${id}`, payload);
  return res.data.data;
}

export async function submitQuote(id: string) {
  const res = await apiClient.post<{ success: true; data: Quote }>(`/quotes/${id}/submit`);
  return res.data.data;
}

export async function markStockUnavailable(id: string, note?: string) {
  const res = await apiClient.post<{ success: true; data: Quote }>(`/quotes/${id}/mark-stock-unavailable`, {
    note,
  });
  return res.data.data;
}

export async function deleteQuote(id: string) {
  await apiClient.delete(`/quotes/${id}`);
}
