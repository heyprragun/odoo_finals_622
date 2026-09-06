import { apiClient } from "./client";
import type { InternalNavAlerts } from "../types/sales";

export async function getInternalNavAlerts() {
  const res = await apiClient.get<{ success: true; data: InternalNavAlerts }>("/nav-alerts");
  return res.data.data;
}
