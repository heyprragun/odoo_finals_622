import { apiClient } from "./client";
import type { GrievanceDetail, GrievanceSummary } from "../types/sales";

export async function listGrievances() {
  const res = await apiClient.get<{ success: true; data: GrievanceSummary[] }>("/grievances");
  return res.data.data;
}

export async function getGrievance(id: string) {
  const res = await apiClient.get<{ success: true; data: GrievanceDetail }>(`/grievances/${id}`);
  return res.data.data;
}

export async function addStaffGrievanceMessage(id: string, message: string) {
  const res = await apiClient.post<{ success: true; data: GrievanceDetail }>(`/grievances/${id}/messages`, {
    message,
  });
  return res.data.data;
}
