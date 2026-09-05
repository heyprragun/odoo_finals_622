import type { NextFunction, Request, Response } from "express";
import * as subscriptionService from "../services/subscription.service";
import { ApiError } from "../utils/ApiError";
import { isUuid } from "../utils/isUuid";
import type { ChangeQuantityInput, OptionalNoteInput } from "../validation/subscription.validation";

export async function listSubscriptions(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await subscriptionService.listSubscriptions();
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getCompanyDetail(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.customerId)) {
      throw ApiError.badRequest("Invalid customer id");
    }
    const detail = await subscriptionService.getCompanySubscriptionDetail(req.params.customerId);
    res.status(200).json({ success: true, data: detail });
  } catch (err) {
    next(err);
  }
}

async function respondWithCompanyDetail(customerId: string, res: Response) {
  const detail = await subscriptionService.getCompanySubscriptionDetail(customerId);
  res.status(200).json({ success: true, data: detail });
}

export async function pauseSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.id)) {
      throw ApiError.badRequest("Invalid subscription id");
    }
    const { note } = req.body as OptionalNoteInput;
    const customerId = await subscriptionService.pauseSubscription(req.params.id, note);
    await respondWithCompanyDetail(customerId, res);
  } catch (err) {
    next(err);
  }
}

export async function resumeSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.id)) {
      throw ApiError.badRequest("Invalid subscription id");
    }
    const { note } = req.body as OptionalNoteInput;
    const customerId = await subscriptionService.resumeSubscription(req.params.id, note);
    await respondWithCompanyDetail(customerId, res);
  } catch (err) {
    next(err);
  }
}

export async function cancelSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.id)) {
      throw ApiError.badRequest("Invalid subscription id");
    }
    const { note } = req.body as OptionalNoteInput;
    const customerId = await subscriptionService.cancelSubscription(req.params.id, note);
    await respondWithCompanyDetail(customerId, res);
  } catch (err) {
    next(err);
  }
}

export async function changeQuantity(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.id)) {
      throw ApiError.badRequest("Invalid subscription id");
    }
    const { quantity } = req.body as ChangeQuantityInput;
    const customerId = await subscriptionService.changeSubscriptionQuantity(req.params.id, quantity);
    await respondWithCompanyDetail(customerId, res);
  } catch (err) {
    next(err);
  }
}
