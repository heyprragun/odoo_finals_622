import type { NextFunction, Request, Response } from "express";
import { listCustomers as listCustomersService, getCustomerById } from "../services/customer.service";
import { ApiError } from "../utils/ApiError";
import { isUuid } from "../utils/isUuid";

export async function listCustomers(_req: Request, res: Response, next: NextFunction) {
  try {
    const customers = await listCustomersService();
    res.status(200).json({ success: true, data: customers });
  } catch (err) {
    next(err);
  }
}

export async function getCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.id)) {
      throw ApiError.badRequest("Invalid customer id");
    }
    const customer = await getCustomerById(req.params.id);
    if (!customer) {
      throw ApiError.notFound("Customer not found");
    }
    res.status(200).json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
}
