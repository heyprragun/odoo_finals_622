import { apiClient } from "./client";
import type { QuoteRecommendation } from "../types/sales";

export async function listRecommendations(quoteId: string) {
  const res = await apiClient.get<{ success: true; data: QuoteRecommendation[] }>(
    `/quotes/${quoteId}/recommendations`
  );
  return res.data.data;
}

export async function generateRecommendations(quoteId: string) {
  const res = await apiClient.post<{ success: true; data: QuoteRecommendation[] }>(
    `/quotes/${quoteId}/recommendations/generate`
  );
  return res.data.data;
}

export async function sendRecommendationToCustomer(quoteId: string, recommendationId: string) {
  const res = await apiClient.post<{ success: true; data: QuoteRecommendation[] }>(
    `/quotes/${quoteId}/recommendations/${recommendationId}/send-to-customer`
  );
  return res.data.data;
}
