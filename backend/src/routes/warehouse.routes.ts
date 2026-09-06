import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticateToken } from "../middleware/authenticateToken";
import { authorizeRoles } from "../middleware/authorizeRoles";
import { validateBody } from "../middleware/validate";
import { createWarehouseSchema } from "../validation/warehouse.validation";
import { getWarehouses, createWarehouse, getWarehouseDetail } from "../controllers/warehouse.controller";

const router = Router();

// Admin-only - warehouse management (create, per-warehouse stock view) is an
// Admin/back-office concern, same boundary as Product Catalog writes and
// the inventory write endpoint this page's stock edits reuse.
router.use(authenticateToken, authorizeRoles(Role.ADMIN));

router.get("/", getWarehouses);
router.post("/", validateBody(createWarehouseSchema), createWarehouse);
router.get("/:id", getWarehouseDetail);

export default router;
