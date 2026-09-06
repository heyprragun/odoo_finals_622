import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { isUuid } from "../utils/isUuid";
import * as reportsService from "../services/reports.service";
import { generateSalesInsights } from "../services/reportsAi.service";
import { streamReportPdf, streamReportXlsx } from "../services/reportsExport.service";

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw ApiError.badRequest(`Invalid date: ${value}`);
  }
  return parsed;
}

export async function getTeamDirectory(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportsService.getTeamDirectory();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

const VALID_BUCKETS: reportsService.QuotationBucket[] = [
  "PENDING_MANAGER",
  "PENDING_FINANCE",
  "PENDING_ADMIN",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "DRAFT_OR_REVISION",
];

export async function getOrdersOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);
    const bucketParam = req.query.bucket;
    let bucket: reportsService.QuotationBucket | undefined;
    if (typeof bucketParam === "string" && bucketParam.length > 0) {
      if (!VALID_BUCKETS.includes(bucketParam as reportsService.QuotationBucket)) {
        throw ApiError.badRequest(`Invalid bucket: ${bucketParam}`);
      }
      bucket = bucketParam as reportsService.QuotationBucket;
    }
    const data = await reportsService.getOrdersOverview({ from, to, bucket });
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getProductPerformance(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportsService.getProductPerformance();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getCustomerTierOverview(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportsService.getCustomerTierOverview();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getCustomerDetail(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.customerId)) {
      throw ApiError.badRequest("Invalid customer id");
    }
    const data = await reportsService.getCustomerDetail(req.params.customerId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getSalesInsights(_req: Request, res: Response, next: NextFunction) {
  try {
    const products = await reportsService.getProductPerformance();
    const data = await generateSalesInsights(products.bestSelling, products.leastSelling);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function exportReport(req: Request, res: Response, next: NextFunction) {
  try {
    const format = req.query.format;
    if (format !== "pdf" && format !== "xlsx") {
      throw ApiError.badRequest("format must be 'pdf' or 'xlsx'");
    }
    const summary = await reportsService.getReportSummary();
    if (format === "pdf") {
      streamReportPdf(res, summary);
    } else {
      await streamReportXlsx(res, summary);
    }
  } catch (err) {
    next(err);
  }
}
