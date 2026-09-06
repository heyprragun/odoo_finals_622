import type { NextFunction, Request, Response } from "express";
import * as grievanceService from "../services/grievance.service";
import { ApiError } from "../utils/ApiError";
import { isUuid } from "../utils/isUuid";
import type { AddGrievanceMessageInput } from "../validation/grievance.validation";

export async function listGrievances(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await grievanceService.listAllGrievances();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getGrievance(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.id)) {
      throw ApiError.badRequest("Invalid grievance id");
    }
    const data = await grievanceService.getGrievanceForStaff(req.params.id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function addStaffMessage(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.id)) {
      throw ApiError.badRequest("Invalid grievance id");
    }
    const input = req.body as AddGrievanceMessageInput;
    const data = await grievanceService.addMessage(
      req.params.id,
      { id: req.user!.id, role: req.user!.role },
      input.message
    );
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
