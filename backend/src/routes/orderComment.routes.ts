import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticateToken } from "../middleware/authenticateToken";
import { authorizeRoles } from "../middleware/authorizeRoles";
import { validateBody } from "../middleware/validate";
import { addOrderCommentSchema } from "../validation/orderComment.validation";
import { listComments, addComment } from "../controllers/orderComment.controller";

// Mounted at /api/quotes/:quoteId/comments - mergeParams so req.params.quoteId
// (from the parent mount path) is visible here.
const router = Router({ mergeParams: true });

// "All the teams" - every internal role, never the Customer (this is
// strictly an internal discussion thread, not a customer-facing channel;
// the customer portal already has its own separate Negotiations mechanism
// for customer<->Sales Rep back-and-forth).
router.use(authenticateToken, authorizeRoles(Role.SALES_REP, Role.MANAGER, Role.FINANCE, Role.ADMIN));

router.get("/", listComments);
router.post("/", validateBody(addOrderCommentSchema), addComment);

export default router;
