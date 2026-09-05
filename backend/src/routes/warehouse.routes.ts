import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticateToken } from "../middleware/authenticateToken";
import { authorizeRoles } from "../middleware/authorizeRoles";
import { getWarehouses } from "../controllers/warehouse.controller";

const router = Router();

// Admin-only for now - the only current consumer is the Admin inventory
// editor on the Products page.
router.get("/", authenticateToken, authorizeRoles(Role.ADMIN), getWarehouses);

export default router;
