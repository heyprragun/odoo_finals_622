import type { NextFunction, Request, Response } from "express";
import * as stockConflictService from "../services/stockConflict.service";
import { ApiError } from "../utils/ApiError";
import { isUuid } from "../utils/isUuid";

export async function listStockConflicts(req: Request, res: Response, next: NextFunction) {
  try {
    const pendingOnly = req.query.pendingOnly !== "false";
    const data = await stockConflictService.listStockConflicts(pendingOnly);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function releaseStockConflict(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.id)) {
      throw ApiError.badRequest("Invalid conflict id");
    }
    await stockConflictService.releaseStockConflict(req.params.id, req.user!);
    const data = await stockConflictService.listStockConflicts(true);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function dismissStockConflict(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.id)) {
      throw ApiError.badRequest("Invalid conflict id");
    }
    await stockConflictService.dismissStockConflict(req.params.id, req.user!);
    const data = await stockConflictService.listStockConflicts(true);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
