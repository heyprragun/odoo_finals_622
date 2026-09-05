import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticateToken } from "../middleware/authenticateToken";
import { authorizeRoles } from "../middleware/authorizeRoles";
import { listCustomers, getCustomer } from "../controllers/customer.controller";

const router = Router();

// Internal roles only. CUSTOMER users must never see other customers' records
// (this stays true once the customer portal is built later).
router.use(
  authenticateToken,
  authorizeRoles(Role.SALES_REP, Role.MANAGER, Role.FINANCE, Role.ADMIN)
);

router.get("/", listCustomers);
router.get("/:id", getCustomer);

export default router;
