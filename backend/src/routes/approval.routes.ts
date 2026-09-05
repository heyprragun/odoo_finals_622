import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticateToken } from "../middleware/authenticateToken";
import { authorizeRoles } from "../middleware/authorizeRoles";
import { validateBody } from "../middleware/validate";
import { approveActionSchema, returnOrRejectActionSchema } from "../validation/approval.validation";
import {
  listApprovals,
  getApprovalDetail,
  approveQuote,
  returnQuoteForRevision,
  rejectQuote,
} from "../controllers/approval.controller";

const router = Router();

// CUSTOMER must never reach the internal approval queue - not covered by
// any of these roles, so it's blocked outright at the route level.
router.use(authenticateToken, authorizeRoles(Role.SALES_REP, Role.MANAGER, Role.FINANCE, Role.ADMIN));

router.get("/", listApprovals);
router.get("/:id", getApprovalDetail);

// Approve/return/reject: SALES_REP is excluded here even though the base
// router above allows them to view - they can never act on their own
// quotation. Manager/Finance stage-matching is enforced again in the
// service layer (defense in depth), since it depends on the quote's current
// status, not just the actor's role.
router.post(
  "/:id/approve",
  authorizeRoles(Role.MANAGER, Role.FINANCE, Role.ADMIN),
  validateBody(approveActionSchema),
  approveQuote
);
router.post(
  "/:id/return",
  authorizeRoles(Role.MANAGER, Role.FINANCE, Role.ADMIN),
  validateBody(returnOrRejectActionSchema),
  returnQuoteForRevision
);
router.post(
  "/:id/reject",
  authorizeRoles(Role.MANAGER, Role.FINANCE, Role.ADMIN),
  validateBody(returnOrRejectActionSchema),
  rejectQuote
);

export default router;
