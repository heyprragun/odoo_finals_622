import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticateToken } from "../middleware/authenticateToken";
import { authorizeRoles } from "../middleware/authorizeRoles";
import { getProductAvailability } from "../controllers/inventory.controller";

const router = Router();

// View-only for every internal role. Nobody can write inventory through this
// router - modification is out of scope until the fulfillment phase.
router.get(
  "/product/:productId",
  authenticateToken,
  authorizeRoles(Role.SALES_REP, Role.MANAGER, Role.FINANCE, Role.ADMIN),
  getProductAvailability
);

export default router;
