import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticateToken } from "../middleware/authenticateToken";
import { authorizeRoles } from "../middleware/authorizeRoles";
import { validateBody } from "../middleware/validate";
import { changeQuantitySchema, optionalNoteSchema } from "../validation/subscription.validation";
import {
  listSubscriptions,
  getCompanyDetail,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  changeQuantity,
} from "../controllers/subscription.controller";

const router = Router();

// View-only for every internal role, shared/global data (not scoped per
// Sales Rep) - CUSTOMER is blocked entirely (internal operational data).
router.use(authenticateToken, authorizeRoles(Role.SALES_REP, Role.MANAGER, Role.FINANCE, Role.ADMIN));

router.get("/", listSubscriptions);
router.get("/company/:customerId", getCompanyDetail);

// Lifecycle/billing management is Finance's job (Admin as oversight
// override), matching the existing RBAC - Sales Rep/Manager can view only.
router.post(
  "/:id/pause",
  authorizeRoles(Role.FINANCE, Role.ADMIN),
  validateBody(optionalNoteSchema),
  pauseSubscription
);
router.post(
  "/:id/resume",
  authorizeRoles(Role.FINANCE, Role.ADMIN),
  validateBody(optionalNoteSchema),
  resumeSubscription
);
router.post(
  "/:id/cancel",
  authorizeRoles(Role.FINANCE, Role.ADMIN),
  validateBody(optionalNoteSchema),
  cancelSubscription
);
router.post(
  "/:id/change-quantity",
  authorizeRoles(Role.FINANCE, Role.ADMIN),
  validateBody(changeQuantitySchema),
  changeQuantity
);

export default router;
