import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { isUuid } from "../utils/isUuid";
import * as customerPortalService from "../services/customerPortal.service";
import * as customerTierChangeService from "../services/customerTierChange.service";
import * as invoiceService from "../services/invoice.service";
import * as grievanceService from "../services/grievance.service";
import * as navAlertsService from "../services/navAlerts.service";
import type {
  AcceptRecommendationInput,
  CancelOrderInput,
  CancelSubscriptionInput,
  CreateMyRequestInput,
  NegotiateQuoteInput,
  RequestTierChangeInput,
  ResolveDiscountReviewInput,
} from "../validation/customerPortal.validation";
import type { AddGrievanceMessageInput, CreateGrievanceInput } from "../validation/grievance.validation";

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
    const data = await customerPortalService.listMySubscriptions(requireCustomerId(req));
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getMySubscription(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.id)) {
      throw ApiError.badRequest("Invalid subscription id");
    }
    const data = await customerPortalService.getMySubscriptionDetail(req.params.id, requireCustomerId(req));
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function cancelMySubscription(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.id)) {
      throw ApiError.badRequest("Invalid subscription id");
    }
    const input = req.body as CancelSubscriptionInput;
    const data = await customerPortalService.cancelMySubscription(
      req.params.id,
      requireCustomerId(req),
      input.reason
    );
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getMyTierChangeInfo(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await customerTierChangeService.getMyTierChangeInfo(requireCustomerId(req));
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function requestTierChange(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as RequestTierChangeInput;
    const data = await customerTierChangeService.requestTierChange(
      requireCustomerId(req),
      input.requestedTier,
      input.note
    );
    res.status(201).json({ success: true, data });
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

export async function downloadMyInvoicePdf(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.id)) {
      throw ApiError.badRequest("Invalid invoice id");
    }
    const { invoiceNumber, buffer } = await invoiceService.getInvoicePdfBufferForCustomer(
      req.params.id,
      requireCustomerId(req)
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${invoiceNumber}.pdf"`);
    res.status(200).send(buffer);
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

export async function listMyDiscountReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await customerPortalService.listMyDiscountReviews(requireCustomerId(req));
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getNavAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await navAlertsService.getCustomerNavAlerts(requireCustomerId(req));
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listMyDeliveredOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await grievanceService.listDeliveredOrders(requireCustomerId(req));
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listMyGrievances(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await grievanceService.listMyGrievances(requireCustomerId(req));
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getMyGrievanceByOrder(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.quoteId)) {
      throw ApiError.badRequest("Invalid order id");
    }
    const data = await grievanceService.getGrievanceByQuoteForCustomer(req.params.quoteId, requireCustomerId(req));
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createMyGrievance(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as CreateGrievanceInput;
    const data = await grievanceService.createGrievance(requireCustomerId(req), input.quoteId, input.description);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function addMyGrievanceMessage(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.id)) {
      throw ApiError.badRequest("Invalid grievance id");
    }
    const input = req.body as AddGrievanceMessageInput;
    const data = await grievanceService.addMessage(
      req.params.id,
      { id: req.user!.id, role: req.user!.role, customerId: requireCustomerId(req) },
      input.message
    );
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function resolveMyGrievance(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.id)) {
      throw ApiError.badRequest("Invalid grievance id");
    }
    const data = await grievanceService.resolveGrievance(req.params.id, requireCustomerId(req));
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function resolveDiscountReview(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.requestId)) {
      throw ApiError.badRequest("Invalid order id");
    }
    const input = req.body as ResolveDiscountReviewInput;
    const data = await customerPortalService.resolveDiscountReview(
      req.params.requestId,
      requireCustomerId(req),
      input.newExpectedDiscountPercentage,
      input.note
    );
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
