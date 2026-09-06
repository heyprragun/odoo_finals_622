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

export async function downloadInvoicePdf(id: string, filename: string) {
  const res = await apiClient.get(`/invoices/${id}/pdf`, { responseType: "blob" });
  const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export interface EmailInvoiceResult {
  previewUrl: string | null;
}

export async function emailInvoice(id: string, email: string) {
  const res = await apiClient.post<{ success: true; data: EmailInvoiceResult }>(`/invoices/${id}/email`, { email });
  return res.data.data;
}
