import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticateToken } from "../middleware/authenticateToken";
import { authorizeRoles } from "../middleware/authorizeRoles";
import { listRequests, getRequest } from "../controllers/customerRequest.controller";

const router = Router();

// SALES_REP only for now. Manager/Admin visibility into requests is a future concern.
router.use(authenticateToken, authorizeRoles(Role.SALES_REP));

router.get("/", listRequests);
router.get("/:id", getRequest);

export default router;
