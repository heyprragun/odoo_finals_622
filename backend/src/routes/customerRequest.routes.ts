import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticateToken } from "../middleware/authenticateToken";
import { authorizeRoles } from "../middleware/authorizeRoles";
import { listRequests, getRequest } from "../controllers/customerRequest.controller";

const router = Router();

// SALES_REP creates/works requests; MANAGER, FINANCE and ADMIN can view the
// same queue (needed for their "same dashboard" view) but never get write
// routes here since there aren't any - this whole router is GET-only.
router.use(authenticateToken, authorizeRoles(Role.SALES_REP, Role.MANAGER, Role.FINANCE, Role.ADMIN));

router.get("/", listRequests);
router.get("/:id", getRequest);

export default router;
