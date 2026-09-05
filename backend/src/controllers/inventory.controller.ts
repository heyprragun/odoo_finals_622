import type { NextFunction, Request, Response } from "express";
import {
  getAvailabilityForProduct,
  getStockSummary,
  setInventoryForProduct,
} from "../services/inventory.service";
import { getProductById } from "../services/product.service";
import { ApiError } from "../utils/ApiError";
import { isUuid } from "../utils/isUuid";
import type { UpdateInventoryInput } from "../validation/inventory.validation";

export async function listStockSummary(_req: Request, res: Response, next: NextFunction) {
  try {
    const summary = await getStockSummary();
    res.status(200).json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
}

function formatAvailability(inventory: Awaited<ReturnType<typeof getAvailabilityForProduct>>) {
  return inventory.map((inv) => ({
    warehouseId: inv.warehouseId,
    warehouseName: inv.warehouse.name,
    location: inv.warehouse.location,
    quantityAvailable: inv.quantityAvailable,
    quantityReserved: inv.quantityReserved,
  }));
}

export async function getProductAvailability(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId } = req.params;
    if (!isUuid(productId)) {
      throw ApiError.badRequest("Invalid product id");
    }
    const product = await getProductById(productId);
    if (!product) {
      throw ApiError.notFound("Product not found");
    }

    const inventory = await getAvailabilityForProduct(productId);
    res.status(200).json({ success: true, data: formatAvailability(inventory) });
  } catch (err) {
    next(err);
  }
}

export async function updateInventory(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId } = req.params;
    if (!isUuid(productId)) {
      throw ApiError.badRequest("Invalid product id");
    }
    const { entries } = req.body as UpdateInventoryInput;
    const inventory = await setInventoryForProduct(productId, entries);
    res.status(200).json({ success: true, data: formatAvailability(inventory) });
  } catch (err) {
    next(err);
  }
}
