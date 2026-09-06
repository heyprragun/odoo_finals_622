import type { NextFunction, Request, Response } from "express";
import * as customerTierChangeService from "../services/customerTierChange.service";
import { ApiError } from "../utils/ApiError";
import { isUuid } from "../utils/isUuid";
import type { DecideTierChangeInput } from "../validation/customerTierChange.validation";

export async function listPending(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await customerTierChangeService.listPendingTierChangeRequests();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function decide(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.id)) {
      throw ApiError.badRequest("Invalid request id");
    }
    const { decision, note } = req.body as DecideTierChangeInput;
    const data = await customerTierChangeService.decideTierChangeRequest(
      req.params.id,
      req.user!.id,
      decision,
      note
    );
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
