import type { NextFunction, Request, Response } from "express";
import { getAvailabilityForProduct } from "../services/inventory.service";
import { getProductById } from "../services/product.service";
import { ApiError } from "../utils/ApiError";
import { isUuid } from "../utils/isUuid";

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
    res.status(200).json({
      success: true,
      data: inventory.map((inv) => ({
        warehouseId: inv.warehouseId,
        warehouseName: inv.warehouse.name,
        location: inv.warehouse.location,
        quantityAvailable: inv.quantityAvailable,
        quantityReserved: inv.quantityReserved,
      })),
    });
  } catch (err) {
    next(err);
  }
}
