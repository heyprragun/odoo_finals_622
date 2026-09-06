import type { NextFunction, Request, Response } from "express";
import * as dealHealthService from "../services/dealHealth.service";
import { ApiError } from "../utils/ApiError";
import { isUuid } from "../utils/isUuid";
import type { DealHealthActionInput } from "../validation/dealHealth.validation";

export async function getDealHealthOverview(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await dealHealthService.getDealHealthOverview();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getDealHealthDetail(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.quoteId)) {
      throw ApiError.badRequest("Invalid quote id");
    }
    const data = await dealHealthService.getDealHealthDetail(req.params.quoteId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function rejectFlaggedDeal(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.quoteId)) {
      throw ApiError.badRequest("Invalid quote id");
    }
    const input = req.body as DealHealthActionInput;
    await dealHealthService.rejectFlaggedDeal(req.params.quoteId, req.user!, input.note);
    const data = await dealHealthService.getDealHealthDetail(req.params.quoteId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function nudgeSalesRep(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.quoteId)) {
      throw ApiError.badRequest("Invalid quote id");
    }
    const input = req.body as DealHealthActionInput;
    await dealHealthService.nudgeSalesRep(req.params.quoteId, req.user!, input.note);
    const data = await dealHealthService.getDealHealthDetail(req.params.quoteId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
