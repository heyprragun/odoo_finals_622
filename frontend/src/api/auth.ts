import { apiClient } from "./client";
import type { AuthResponse, LoginPayload, RegisterPayload } from "../types/auth";

export async function registerRequest(payload: RegisterPayload) {
  const res = await apiClient.post<AuthResponse>("/auth/register", payload);
  return res.data.data;
}

export async function loginRequest(payload: LoginPayload) {
  const res = await apiClient.post<AuthResponse>("/auth/login", payload);
  return res.data.data;
}
