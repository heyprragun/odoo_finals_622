import type { NextFunction, Request, Response } from "express";
import type { Customer, CustomerRequest, CustomerRequestItem, Product, Quote, Subscription } from "@prisma/client";
import {
  listActiveCustomerRequests,
  getCustomerRequestById,
} from "../services/customerRequest.service";
import { ApiError } from "../utils/ApiError";
import { isUuid } from "../utils/isUuid";

type RequestWithCustomerAndItems = CustomerRequest & {
  customer: Customer;
  items: CustomerRequestItem[];
};

type LinkedQuoteSummary = Pick<Quote, "id" | "quoteNumber" | "status">;

type RequestWithFullItems = CustomerRequest & {
  customer: Customer;
  items: (CustomerRequestItem & { product: Product })[];
  quote: LinkedQuoteSummary | null;
  modifiesSubscription: (Subscription & { product: Product }) | null;
};

function summarize(request: RequestWithCustomerAndItems) {
  return {
    id: request.id,
    customerId: request.customerId,
    customer: { id: request.customer.id, name: request.customer.name, tier: request.customer.tier },
    status: request.status,
    notes: request.notes,
    itemCount: request.items.length,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

function detail(request: RequestWithFullItems) {
  return {
    id: request.id,
    customerId: request.customerId,
    customer: { id: request.customer.id, name: request.customer.name, tier: request.customer.tier },
    status: request.status,
    notes: request.notes,
    expectedDiscountPercentage:
      request.expectedDiscountPercentage === null ? null : Number(request.expectedDiscountPercentage),
    shippingLocation: request.shippingLocation,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    quote: request.quote
      ? { id: request.quote.id, quoteNumber: request.quote.quoteNumber, status: request.quote.status }
      : null,
    modifiesSubscription: request.modifiesSubscription
      ? {
          id: request.modifiesSubscription.id,
          productName: request.modifiesSubscription.product.name,
          quantity: request.modifiesSubscription.quantity,
          currentBillingCycle: request.modifiesSubscription.billingCycle,
        }
      : null,
    items: request.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      requestedQuantity: item.requestedQuantity,
      notes: item.notes,
      product: {
        id: item.product.id,
        name: item.product.name,
        sku: item.product.sku,
        category: item.product.category,
        unitPrice: Number(item.product.unitPrice),
      },
    })),
  };
}

export async function listRequests(_req: Request, res: Response, next: NextFunction) {
  try {
    const requests = await listActiveCustomerRequests();
    res.status(200).json({ success: true, data: requests.map(summarize) });
  } catch (err) {
    next(err);
  }
}

export async function getRequest(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.id)) {
      throw ApiError.badRequest("Invalid customer request id");
    }
    const request = await getCustomerRequestById(req.params.id);
    if (!request) {
      throw ApiError.notFound("Customer request not found");
    }
    res.status(200).json({ success: true, data: detail(request) });
  } catch (err) {
    next(err);
  }
}
