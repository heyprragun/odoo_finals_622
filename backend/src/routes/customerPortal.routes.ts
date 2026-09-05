import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticateToken } from "../middleware/authenticateToken";
import { authorizeRoles } from "../middleware/authorizeRoles";
import { validateBody } from "../middleware/validate";
import {
  acceptRecommendationSchema,
  cancelOrderSchema,
  createMyRequestSchema,
  negotiateQuoteSchema,
} from "../validation/customerPortal.validation";
import {
  listMyOrders,
  getMyOrder,
  cancelMyOrder,
  listMySubscriptions,
  listMyInvoices,
  createMyRequest,
  listMyNegotiableQuotes,
  negotiateQuote,
  acceptRecommendation,
  declineRecommendation,
} from "../controllers/customerPortal.controller";

const router = Router();

// The customer portal's own self-scoped endpoints - every handler derives
// the caller's customerId from the authenticated JWT, never from the
// request body/params, so a customer can only ever see or act on their own
// company's data.
router.use(authenticateToken, authorizeRoles(Role.CUSTOMER));

router.get("/orders", listMyOrders);
router.get("/orders/:id", getMyOrder);
router.post("/orders/:id/cancel", validateBody(cancelOrderSchema), cancelMyOrder);
router.get("/subscriptions", listMySubscriptions);
router.get("/invoices", listMyInvoices);
router.post("/requests", validateBody(createMyRequestSchema), createMyRequest);
router.get("/negotiations", listMyNegotiableQuotes);
router.post("/negotiations/:quoteId", validateBody(negotiateQuoteSchema), negotiateQuote);
router.post(
  "/recommendations/:recommendationId/accept",
  validateBody(acceptRecommendationSchema),
  acceptRecommendation
);
router.post("/recommendations/:recommendationId/decline", declineRecommendation);

export default router;
