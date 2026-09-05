import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticateToken } from "../middleware/authenticateToken";
import { authorizeRoles } from "../middleware/authorizeRoles";
import { validateBody } from "../middleware/validate";
import { updateInventorySchema } from "../validation/inventory.validation";
import {
  getProductAvailability,
  getStockAllocation,
  listStockSummary,
  updateInventory,
} from "../controllers/inventory.controller";

const router = Router();

// View-only, shared/global (not scoped per Sales Rep) - allocation/
// splitting write logic is still a later phase. FINANCE does not get
// Fulfillment access.
router.get(
  "/",
  authenticateToken,
  authorizeRoles(Role.SALES_REP, Role.MANAGER, Role.ADMIN),
  listStockSummary
);
router.get(
  "/product/:productId",
  authenticateToken,
  authorizeRoles(Role.SALES_REP, Role.MANAGER, Role.ADMIN),
  getProductAvailability
);
router.get(
  "/product/:productId/allocation",
  authenticateToken,
  authorizeRoles(Role.SALES_REP, Role.MANAGER, Role.ADMIN),
  getStockAllocation
);

// Stock write is Admin-only.
router.put(
  "/product/:productId",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  validateBody(updateInventorySchema),
  updateInventory
);

export default router;
