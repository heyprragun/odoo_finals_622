import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { isUuid } from "../utils/isUuid";
import * as customerPortalService from "../services/customerPortal.service";
import type {
  AcceptRecommendationInput,
  CancelOrderInput,
  CreateMyRequestInput,
  NegotiateQuoteInput,
} from "../validation/customerPortal.validation";

// A CUSTOMER-role user without a linked customerId can't be scoped to any
// company data - defensive guard, since normal seeding/registration always
// links one.
function requireCustomerId(req: Request): string {
  const customerId = req.user!.customerId;
  if (!customerId) {
    throw ApiError.badRequest("Your account is not linked to a customer company");
  }
  return customerId;
}

export async function listMyOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await customerPortalService.listMyOrders(requireCustomerId(req));
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getMyOrder(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.id)) {
      throw ApiError.badRequest("Invalid order id");
    }
    const data = await customerPortalService.getMyOrderDetail(req.params.id, requireCustomerId(req));
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function cancelMyOrder(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.id)) {
      throw ApiError.badRequest("Invalid order id");
    }
    const input = req.body as CancelOrderInput;
    const data = await customerPortalService.cancelMyOrder(
      req.params.id,
      requireCustomerId(req),
      req.user!.id,
      input.reason
    );
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listMySubscriptions(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await customerPortalService.listMyActiveSubscriptions(requireCustomerId(req));
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listMyInvoices(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await customerPortalService.listMyInvoices(requireCustomerId(req));
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createMyRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as CreateMyRequestInput;
    const data = await customerPortalService.createMyRequest(requireCustomerId(req), input);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listMyNegotiableQuotes(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await customerPortalService.listMyNegotiableQuotes(requireCustomerId(req));
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function negotiateQuote(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.quoteId)) {
      throw ApiError.badRequest("Invalid quote id");
    }
    const input = req.body as NegotiateQuoteInput;
    const data = await customerPortalService.negotiateQuote(
      req.params.quoteId,
      requireCustomerId(req),
      req.user!.id,
      input
    );
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function acceptRecommendation(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.recommendationId)) {
      throw ApiError.badRequest("Invalid recommendation id");
    }
    const input = req.body as AcceptRecommendationInput;
    const data = await customerPortalService.acceptRecommendation(
      req.params.recommendationId,
      requireCustomerId(req),
      input
    );
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function declineRecommendation(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.recommendationId)) {
      throw ApiError.badRequest("Invalid recommendation id");
    }
    await customerPortalService.declineRecommendation(req.params.recommendationId, requireCustomerId(req));
    res.status(200).json({ success: true, data: { declined: true } });
  } catch (err) {
    next(err);
  }
}
