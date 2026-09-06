import type { NextFunction, Request, Response } from "express";
import * as warehouseService from "../services/warehouse.service";
import { ApiError } from "../utils/ApiError";
import { isUuid } from "../utils/isUuid";
import type { CreateWarehouseInput } from "../validation/warehouse.validation";

export async function getWarehouses(_req: Request, res: Response, next: NextFunction) {
  try {
    const warehouses = await warehouseService.listWarehouses();
    res.status(200).json({ success: true, data: warehouses });
  } catch (err) {
    next(err);
  }
}

export async function createWarehouse(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as CreateWarehouseInput;
    const warehouse = await warehouseService.createWarehouse(input);
    res.status(201).json({ success: true, data: warehouse });
  } catch (err) {
    next(err);
  }
}

export async function getWarehouseDetail(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.id)) {
      throw ApiError.badRequest("Invalid warehouse id");
    }
    const detail = await warehouseService.getWarehouseDetail(req.params.id);
    res.status(200).json({ success: true, data: detail });
  } catch (err) {
    next(err);
  }
}
