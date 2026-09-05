import type { NextFunction, Request, Response } from "express";
import { registerUser, loginUser } from "../services/auth.service";
import type { RegisterInput, LoginInput } from "../validation/auth.validation";

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as RegisterInput;
    const { user, token } = await registerUser(input);
    res.status(201).json({ success: true, data: { user, token } });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as LoginInput;
    const { user, token } = await loginUser(input);
    res.status(200).json({ success: true, data: { user, token } });
  } catch (err) {
    next(err);
  }
}
