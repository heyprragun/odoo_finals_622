import type { NextFunction, Request, Response } from "express";
import * as navAlertsService from "../services/navAlerts.service";

export async function getInternalNavAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await navAlertsService.getInternalNavAlerts(req.user!);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
