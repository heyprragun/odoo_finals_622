import type { NextFunction, Request, Response } from "express";
import * as quoteService from "../services/quote.service";
import { sanitizeQuote } from "../utils/sanitizeQuote";
import { ApiError } from "../utils/ApiError";
import { isUuid } from "../utils/isUuid";
import type {
  CreateQuoteInput,
  MarkStockUnavailableInput,
  UpdateQuoteInput,
} from "../validation/quote.validation";

export async function listMyQuotes(req: Request, res: Response, next: NextFunction) {
  try {
    const quotes = await quoteService.listQuotes(req.user!);
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
    const quote = await quoteService.getQuoteForUser(req.params.id, req.user!);
    res.status(200).json({ success: true, data: sanitizeQuote(quote) });
  } catch (err) {
    next(err);
  }
}

export async function createQuote(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as CreateQuoteInput;
    const { quote, created } = await quoteService.createQuote(input, req.user!.id);
    // 200 when an existing quote for this request was reused instead of a
    // new one being created (a request converts into at most one quotation).
    res.status(created ? 201 : 200).json({ success: true, data: sanitizeQuote(quote) });
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

export async function markStockUnavailable(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.id)) {
      throw ApiError.badRequest("Invalid quote id");
    }
    const input = req.body as MarkStockUnavailableInput;
    const quote = await quoteService.markStockUnavailable(req.params.id, req.user!, input.note);
    res.status(200).json({ success: true, data: sanitizeQuote(quote) });
  } catch (err) {
    next(err);
  }
}
