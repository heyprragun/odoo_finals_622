import type { NextFunction, Request, Response } from "express";
import * as orderCommentService from "../services/orderComment.service";
import { ApiError } from "../utils/ApiError";
import { isUuid } from "../utils/isUuid";
import type { AddOrderCommentInput } from "../validation/orderComment.validation";

export async function listComments(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.quoteId)) {
      throw ApiError.badRequest("Invalid quote id");
    }
    const data = await orderCommentService.listComments(req.params.quoteId, req.user!);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function addComment(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.quoteId)) {
      throw ApiError.badRequest("Invalid quote id");
    }
    const input = req.body as AddOrderCommentInput;
    const data = await orderCommentService.addComment(req.params.quoteId, req.user!, input.message);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
