import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticateToken } from "../middleware/authenticateToken";
import { authorizeRoles } from "../middleware/authorizeRoles";
import { listStockConflicts, releaseStockConflict, dismissStockConflict } from "../controllers/stockConflict.controller";

const router = Router();

// Reallocating one paying customer's reserved stock to another is a
// Manager/Admin call, same reasoning (and same two roles) as the Deal
// Health reject/nudge actions - never the Sales Rep who happened to hit the
// conflict, and never Finance (this isn't a discount/billing decision).
router.use(authenticateToken, authorizeRoles(Role.MANAGER, Role.ADMIN));

router.get("/", listStockConflicts);
router.post("/:id/release", releaseStockConflict);
router.post("/:id/dismiss", dismissStockConflict);

export default router;
