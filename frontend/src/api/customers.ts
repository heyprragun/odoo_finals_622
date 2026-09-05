import { apiClient } from "./client";
import type { CustomerSummary } from "../types/sales";

export async function listCustomers() {
  const res = await apiClient.get<{ success: true; data: CustomerSummary[] }>("/customers");
  return res.data.data;
}
