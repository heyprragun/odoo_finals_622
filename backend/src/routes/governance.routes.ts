import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticateToken } from "../middleware/authenticateToken";
import { authorizeRoles } from "../middleware/authorizeRoles";
import { validateBody } from "../middleware/validate";
import { updateGovernanceSettingsSchema } from "../validation/governance.validation";
import { getGovernanceSettings, updateGovernanceSettings } from "../controllers/governance.controller";

const router = Router();

// Admin-only: these thresholds drive the discount-governance risk engine
// that decides approval routing for every quote.
router.use(authenticateToken, authorizeRoles(Role.ADMIN));

router.get("/", getGovernanceSettings);
router.put("/", validateBody(updateGovernanceSettingsSchema), updateGovernanceSettings);

export default router;
