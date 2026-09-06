import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticateToken } from "../middleware/authenticateToken";
import { authorizeRoles } from "../middleware/authorizeRoles";
import { validateBody } from "../middleware/validate";
import { decideTierChangeSchema } from "../validation/customerTierChange.validation";
import { listPending, decide } from "../controllers/customerTierChange.controller";

const router = Router();

// Customer-initiated plan tier (Gold/Silver/Bronze) upgrade/downgrade
// requests (portal's "Upgrade Subscription" tab) - Admin is the sole
// decision-maker here, unlike the multi-stage quote approval chain.
router.use(authenticateToken, authorizeRoles(Role.ADMIN));

router.get("/", listPending);
router.post("/:id/decide", validateBody(decideTierChangeSchema), decide);

export default router;
