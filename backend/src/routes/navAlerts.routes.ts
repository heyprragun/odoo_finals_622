import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticateToken } from "../middleware/authenticateToken";
import { authorizeRoles } from "../middleware/authorizeRoles";
import { getInternalNavAlerts } from "../controllers/navAlerts.controller";

const router = Router();

// One small call the Sales Workspace nav makes on every mount to light up a
// dot on whichever tabs have something worth checking - CUSTOMER has its
// own equivalent under /api/portal/nav-alerts instead.
router.use(authenticateToken, authorizeRoles(Role.SALES_REP, Role.MANAGER, Role.FINANCE, Role.ADMIN));

router.get("/", getInternalNavAlerts);

export default router;
