import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticateToken } from "../middleware/authenticateToken";
import { authorizeRoles } from "../middleware/authorizeRoles";
import { validateBody } from "../middleware/validate";
import { createProductSchema, updateProductSchema } from "../validation/product.validation";
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/product.controller";

const router = Router();

// FINANCE does not get product-catalog access. CUSTOMER passes this gate for
// the read routes only (their "Create New Request" product dropdown) - the
// write routes below layer their own Role.ADMIN-only gate on top.
router.use(authenticateToken, authorizeRoles(Role.SALES_REP, Role.MANAGER, Role.ADMIN, Role.CUSTOMER));

router.get("/", listProducts);
router.get("/:id", getProduct);

// Master-data management is Admin-only.
router.post("/", authorizeRoles(Role.ADMIN), validateBody(createProductSchema), createProduct);
router.put("/:id", authorizeRoles(Role.ADMIN), validateBody(updateProductSchema), updateProduct);
router.delete("/:id", authorizeRoles(Role.ADMIN), deleteProduct);

export default router;
