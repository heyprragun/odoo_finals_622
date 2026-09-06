import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticateToken } from "../middleware/authenticateToken";
import { authorizeRoles } from "../middleware/authorizeRoles";
import { validateBody } from "../middleware/validate";
import { dealHealthActionSchema } from "../validation/dealHealth.validation";
import {
  getDealHealthOverview,
  getDealHealthDetail,
  rejectFlaggedDeal,
  nudgeSalesRep,
} from "../controllers/dealHealth.controller";

const router = Router();

// Company-wide visibility into every Sales Rep's deals - Manager and Admin
// only, same reasoning as the Admin Reports section but Manager is included
// here since stalled/anomalous/slipping deals are exactly what a Sales
// Manager is expected to act on day to day.
router.use(authenticateToken, authorizeRoles(Role.MANAGER, Role.ADMIN));

router.get("/", getDealHealthOverview);
router.get("/:quoteId", getDealHealthDetail);
router.post("/:quoteId/reject", validateBody(dealHealthActionSchema), rejectFlaggedDeal);
router.post("/:quoteId/nudge", validateBody(dealHealthActionSchema), nudgeSalesRep);

export default router;
