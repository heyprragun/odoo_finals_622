import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import type { Role } from "@prisma/client";

export interface JwtPayload {
  sub: string; // user id
  role: Role;
  // Present only for CUSTOMER-role users - the customer-portal routes derive
  // resource ownership from this rather than trusting anything client-sent.
  customerId?: string | null;
}

export function generateToken(payload: JwtPayload): string {
  const options: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  };
  return jwt.sign(payload, env.jwtSecret, options);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
}
