import type { Request, Response } from "express";

export function pingAsRole(req: Request, res: Response) {
  res.status(200).json({
    success: true,
    message: `Access granted. Hello, ${req.user?.role}.`,
    data: { userId: req.user?.id, role: req.user?.role },
  });
}
