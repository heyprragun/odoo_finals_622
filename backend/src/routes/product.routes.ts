import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticateToken } from "../middleware/authenticateToken";
import { authorizeRoles } from "../middleware/authorizeRoles";
import { listProducts, getProduct } from "../controllers/product.controller";

const router = Router();

router.use(
  authenticateToken,
  authorizeRoles(Role.SALES_REP, Role.MANAGER, Role.FINANCE, Role.ADMIN)
);

router.get("/", listProducts);
router.get("/:id", getProduct);

export default router;
