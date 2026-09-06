import { apiClient } from "./client";
import type {
  CustomerReportDetail,
  CustomerTierRow,
  ProductPerformanceResponse,
  QuotationBucket,
  QuotationsOverviewResponse,
  SalesInsightsResult,
  TeamMemberPerformance,
} from "../types/sales";

export async function getTeamDirectory() {
  const res = await apiClient.get<{ success: true; data: TeamMemberPerformance[] }>("/reports/team");
  return res.data.data;
}

export async function getOrdersOverview(params: { from?: string; to?: string; bucket?: QuotationBucket }) {
  const res = await apiClient.get<{ success: true; data: QuotationsOverviewResponse }>("/reports/orders", {
    params,
  });
  return res.data.data;
}

export async function getProductPerformance() {
  const res = await apiClient.get<{ success: true; data: ProductPerformanceResponse }>("/reports/products");
  return res.data.data;
}

export async function getCustomerTierOverview() {
  const res = await apiClient.get<{ success: true; data: CustomerTierRow[] }>("/reports/customers");
  return res.data.data;
}

export async function getCustomerReportDetail(customerId: string) {
  const res = await apiClient.get<{ success: true; data: CustomerReportDetail }>(
    `/reports/customers/${customerId}`
  );
  return res.data.data;
}

export async function getSalesInsights() {
  const res = await apiClient.get<{ success: true; data: SalesInsightsResult }>("/reports/ai-insights");
  return res.data.data;
}

// Downloads the export as a real file, since this is the live app (not a
// sandboxed artifact) - fetch as a blob and trigger the browser's normal
// save-file flow via a throwaway anchor element.
export async function downloadReportExport(format: "pdf" | "xlsx") {
  const res = await apiClient.get("/reports/export", {
    params: { format },
    responseType: "blob",
  });
  const blob = new Blob([res.data]);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `dealflow360-report.${format}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
