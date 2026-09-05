export type Role = "SALES_REP" | "MANAGER" | "FINANCE" | "CUSTOMER" | "ADMIN";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  success: true;
  data: {
    user: AuthUser;
    token: string;
  };
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: Role;
  // Required only when role is CUSTOMER - see Register.tsx.
  companyName?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}
