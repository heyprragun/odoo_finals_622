import type { NextFunction, Request, Response } from "express";
import { searchProducts, getProductById } from "../services/product.service";
import { sanitizeProduct } from "../utils/sanitizeProduct";
import { ApiError } from "../utils/ApiError";
import { isUuid } from "../utils/isUuid";

export async function listProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const { search, category, includeInactive } = req.query;
    const products = await searchProducts({
      search: typeof search === "string" ? search : undefined,
      category: typeof category === "string" ? category : undefined,
      activeOnly: includeInactive !== "true",
    });
    res.status(200).json({
      success: true,
      data: products.map((product) => sanitizeProduct(product, req.user!.role)),
    });
  } catch (err) {
    next(err);
  }
}

export async function getProduct(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isUuid(req.params.id)) {
      throw ApiError.badRequest("Invalid product id");
    }
    const product = await getProductById(req.params.id);
    if (!product) {
      throw ApiError.notFound("Product not found");
    }
    res.status(200).json({ success: true, data: sanitizeProduct(product, req.user!.role) });
  } catch (err) {
    next(err);
  }
}
