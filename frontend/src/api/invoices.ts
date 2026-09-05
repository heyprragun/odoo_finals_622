import { apiClient } from "./client";
import type { InvoiceDetail, InvoiceListItem, InvoicesSummary } from "../types/sales";

export interface InvoicesListResponse {
  summary: InvoicesSummary;
  items: InvoiceListItem[];
}

export async function listInvoices() {
  const res = await apiClient.get<{ success: true; data: InvoicesListResponse }>("/invoices");
  return res.data.data;
}

export async function getInvoiceDetail(id: string) {
  const res = await apiClient.get<{ success: true; data: InvoiceDetail }>(`/invoices/${id}`);
  return res.data.data;
}

export async function markInvoiceAsPaid(id: string) {
  const res = await apiClient.post<{ success: true; data: InvoiceDetail }>(`/invoices/${id}/mark-paid`);
  return res.data.data;
}
