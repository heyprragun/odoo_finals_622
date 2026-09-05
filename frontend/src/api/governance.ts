import { apiClient } from "./client";
import type { GovernanceSettings } from "../types/sales";

export async function getGovernanceSettings() {
  const res = await apiClient.get<{ success: true; data: GovernanceSettings }>(
    "/governance-settings"
  );
  return res.data.data;
}

export async function updateGovernanceSettings(settings: GovernanceSettings) {
  const res = await apiClient.put<{ success: true; data: GovernanceSettings }>(
    "/governance-settings",
    settings
  );
  return res.data.data;
}
