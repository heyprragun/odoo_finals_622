import { apiClient } from "./client";
import type { Warehouse } from "../types/sales";

export async function listWarehouses() {
  const res = await apiClient.get<{ success: true; data: Warehouse[] }>("/warehouses");
  return res.data.data;
}
