import type { NextFunction, Request, Response } from "express";
import * as quoteService from "../services/quote.service";
import { sanitizeQuote } from "../utils/sanitizeQuote";
import { ApiError } from "../utils/ApiError";
import { isUuid } from "../utils/isUuid";
import type { CreateQuoteInput, UpdateQuoteInput } from "../validation/quote.validation";

export async function listMyQuotes(req: Request, res: Response, next: NextFunction) {
  try {
    const quotes = await quoteService.listQuotesForSalesRep(req.user!.id);
    res.status(200).json({ success: true, data: quotes.map(sanitizeQuote) });
  } catch (err) {
    next(err);
  }
}

export async function getQuote(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.id)) {
      throw ApiError.badRequest("Invalid quote id");
    }
    const quote = await quoteService.getQuoteForSalesRep(req.params.id, req.user!);
    res.status(200).json({ success: true, data: sanitizeQuote(quote) });
  } catch (err) {
    next(err);
  }
}

export async function createQuote(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as CreateQuoteInput;
    const quote = await quoteService.createQuote(input, req.user!.id);
    res.status(201).json({ success: true, data: sanitizeQuote(quote) });
  } catch (err) {
    next(err);
  }
}

export async function updateQuote(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.id)) {
      throw ApiError.badRequest("Invalid quote id");
    }
    const input = req.body as UpdateQuoteInput;
    const quote = await quoteService.updateQuote(req.params.id, input, req.user!);
    res.status(200).json({ success: true, data: sanitizeQuote(quote) });
  } catch (err) {
    next(err);
  }
}

export async function submitQuote(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.id)) {
      throw ApiError.badRequest("Invalid quote id");
    }
    const quote = await quoteService.submitQuote(req.params.id, req.user!);
    res.status(200).json({ success: true, data: sanitizeQuote(quote) });
  } catch (err) {
    next(err);
  }
}
