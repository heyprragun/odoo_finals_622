import { apiClient } from "./client";
import type { CustomerRequestDetail, CustomerRequestListItem } from "../types/sales";

export async function listCustomerRequests() {
  const res = await apiClient.get<{ success: true; data: CustomerRequestListItem[] }>(
    "/customer-requests"
  );
  return res.data.data;
}

export async function getCustomerRequest(id: string) {
  const res = await apiClient.get<{ success: true; data: CustomerRequestDetail }>(
    `/customer-requests/${id}`
  );
  return res.data.data;
}
