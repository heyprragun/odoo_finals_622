import { apiClient } from "./client";
import type { OrderComment } from "../types/sales";

export async function listOrderComments(quoteId: string) {
  const res = await apiClient.get<{ success: true; data: OrderComment[] }>(`/quotes/${quoteId}/comments`);
  return res.data.data;
}

export async function addOrderComment(quoteId: string, message: string) {
  const res = await apiClient.post<{ success: true; data: OrderComment[] }>(`/quotes/${quoteId}/comments`, {
    message,
  });
  return res.data.data;
}
