import { apiClient } from "./client";
import type { Warehouse, WarehouseDetail } from "../types/sales";

export async function listWarehouses() {
  const res = await apiClient.get<{ success: true; data: Warehouse[] }>("/warehouses");
  return res.data.data;
}

export async function createWarehouse(input: { name: string; location: string }) {
  const res = await apiClient.post<{ success: true; data: Warehouse }>("/warehouses", input);
  return res.data.data;
}

export async function getWarehouseDetail(id: string) {
  const res = await apiClient.get<{ success: true; data: WarehouseDetail }>(`/warehouses/${id}`);
  return res.data.data;
}
