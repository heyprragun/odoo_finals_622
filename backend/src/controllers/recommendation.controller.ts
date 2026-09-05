import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { isUuid } from "../utils/isUuid";
import * as recommendationService from "../services/recommendation.service";

function getQuoteId(req: Request): string {
  const quoteId = req.params.quoteId;
  if (!isUuid(quoteId)) {
    throw ApiError.badRequest("Invalid quote id");
  }
  return quoteId;
}

export async function listRecommendations(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await recommendationService.listRecommendations(getQuoteId(req), req.user!);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function generateRecommendations(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await recommendationService.generateRecommendationsForQuote(getQuoteId(req), req.user!);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function sendRecommendationToCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const quoteId = getQuoteId(req);
    if (!isUuid(req.params.recommendationId)) {
      throw ApiError.badRequest("Invalid recommendation id");
    }
    const data = await recommendationService.sendRecommendationToCustomer(
      quoteId,
      req.params.recommendationId,
      req.user!
    );
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
