import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/jwt";
import { ApiError } from "../utils/ApiError";

export function authenticateToken(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(ApiError.unauthorized("Missing or malformed Authorization header"));
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return next(ApiError.unauthorized("Missing token"));
  }

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err: any) {
    if (err?.name === "TokenExpiredError") {
      return next(ApiError.unauthorized("Token has expired"));
    }
    return next(ApiError.unauthorized("Invalid token"));
  }
}
