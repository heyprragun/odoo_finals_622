import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticateToken } from "../middleware/authenticateToken";
import { authorizeRoles } from "../middleware/authorizeRoles";
import { validateBody } from "../middleware/validate";
import { addGrievanceMessageSchema } from "../validation/grievance.validation";
import { listGrievances, getGrievance, addStaffMessage } from "../controllers/grievance.controller";

const router = Router();

// Grievances are visible only to Manager and Admin - never Sales Rep or
// Finance (matches the user's explicit ask), and the Customer reaches the
// same data through their own scoped /api/portal/grievances routes instead.
router.use(authenticateToken, authorizeRoles(Role.MANAGER, Role.ADMIN));

router.get("/", listGrievances);
router.get("/:id", getGrievance);
router.post("/:id/messages", validateBody(addGrievanceMessageSchema), addStaffMessage);

export default router;
