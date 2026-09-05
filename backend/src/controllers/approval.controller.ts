import type { NextFunction, Request, Response } from "express";
import * as approvalService from "../services/approval.service";
import { ApiError } from "../utils/ApiError";
import { isUuid } from "../utils/isUuid";
import type { ApproveActionInput, ReturnOrRejectActionInput } from "../validation/approval.validation";

export async function listApprovals(req: Request, res: Response, next: NextFunction) {
  try {
    const pendingOnly = req.query.pendingOnly === "true";
    const result = await approvalService.listApprovals(req.user!, pendingOnly);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getApprovalDetail(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.id)) {
      throw ApiError.badRequest("Invalid quote id");
    }
    const detail = await approvalService.getApprovalDetail(req.params.id, req.user!);
    res.status(200).json({ success: true, data: detail });
  } catch (err) {
    next(err);
  }
}

export async function approveQuote(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.id)) {
      throw ApiError.badRequest("Invalid quote id");
    }
    const { note } = req.body as ApproveActionInput;
    const detail = await approvalService.approveQuote(req.params.id, req.user!, note);
    res.status(200).json({ success: true, data: detail });
  } catch (err) {
    next(err);
  }
}

export async function returnQuoteForRevision(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.id)) {
      throw ApiError.badRequest("Invalid quote id");
    }
    const { note } = req.body as ReturnOrRejectActionInput;
    const detail = await approvalService.returnQuoteForRevision(req.params.id, req.user!, note);
    res.status(200).json({ success: true, data: detail });
  } catch (err) {
    next(err);
  }
}

export async function rejectQuote(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.id)) {
      throw ApiError.badRequest("Invalid quote id");
    }
    const { note } = req.body as ReturnOrRejectActionInput;
    const detail = await approvalService.rejectQuote(req.params.id, req.user!, note);
    res.status(200).json({ success: true, data: detail });
  } catch (err) {
    next(err);
  }
}
