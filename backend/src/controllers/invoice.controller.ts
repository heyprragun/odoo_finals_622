import type { NextFunction, Request, Response } from "express";
import * as invoiceService from "../services/invoice.service";
import { ApiError } from "../utils/ApiError";
import { isUuid } from "../utils/isUuid";

export async function listInvoices(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await invoiceService.listInvoices();
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getInvoiceDetail(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.id)) {
      throw ApiError.badRequest("Invalid invoice id");
    }
    const detail = await invoiceService.getInvoiceDetail(req.params.id);
    res.status(200).json({ success: true, data: detail });
  } catch (err) {
    next(err);
  }
}

export async function markInvoiceAsPaid(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.id)) {
      throw ApiError.badRequest("Invalid invoice id");
    }
    const detail = await invoiceService.markInvoiceAsPaid(req.params.id);
    res.status(200).json({ success: true, data: detail });
  } catch (err) {
    next(err);
  }
}
