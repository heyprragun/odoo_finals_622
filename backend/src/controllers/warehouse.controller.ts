import type { NextFunction, Request, Response } from "express";
import { listWarehouses } from "../services/warehouse.service";

export async function getWarehouses(_req: Request, res: Response, next: NextFunction) {
  try {
    const warehouses = await listWarehouses();
    res.status(200).json({ success: true, data: warehouses });
  } catch (err) {
    next(err);
  }
}
