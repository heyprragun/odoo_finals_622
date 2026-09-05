import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticateToken } from "../middleware/authenticateToken";
import { authorizeRoles } from "../middleware/authorizeRoles";
import { pingAsRole } from "../controllers/test.controller";

const router = Router();

router.get("/sales-rep", authenticateToken, authorizeRoles(Role.SALES_REP), pingAsRole);
router.get("/manager", authenticateToken, authorizeRoles(Role.MANAGER), pingAsRole);
router.get("/finance", authenticateToken, authorizeRoles(Role.FINANCE), pingAsRole);
router.get("/customer", authenticateToken, authorizeRoles(Role.CUSTOMER), pingAsRole);

export default router;
