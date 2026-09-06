import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticateToken } from "../middleware/authenticateToken";
import { authorizeRoles } from "../middleware/authorizeRoles";
import { validateBody } from "../middleware/validate";
import {
  acceptRecommendationSchema,
  cancelOrderSchema,
  cancelSubscriptionSchema,
  createMyRequestSchema,
  negotiateQuoteSchema,
  requestTierChangeSchema,
  resolveDiscountReviewSchema,
} from "../validation/customerPortal.validation";
import { addGrievanceMessageSchema, createGrievanceSchema } from "../validation/grievance.validation";
import {
  listMyOrders,
  getMyOrder,
  cancelMyOrder,
  listMySubscriptions,
  getMySubscription,
  cancelMySubscription,
  getMyTierChangeInfo,
  requestTierChange,
  listMyInvoices,
  downloadMyInvoicePdf,
  listMyDeliveredOrders,
  listMyGrievances,
  getMyGrievanceByOrder,
  createMyGrievance,
  addMyGrievanceMessage,
  resolveMyGrievance,
  createMyRequest,
  listMyNegotiableQuotes,
  negotiateQuote,
  acceptRecommendation,
  declineRecommendation,
  listMyDiscountReviews,
  resolveDiscountReview,
  getNavAlerts,
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
router.get("/subscriptions/:id", getMySubscription);
router.post("/subscriptions/:id/cancel", validateBody(cancelSubscriptionSchema), cancelMySubscription);
router.get("/tier-change-requests", getMyTierChangeInfo);
router.post("/tier-change-requests", validateBody(requestTierChangeSchema), requestTierChange);
router.get("/invoices", listMyInvoices);
router.get("/invoices/:id/pdf", downloadMyInvoicePdf);
router.get("/delivered-orders", listMyDeliveredOrders);
router.get("/grievances", listMyGrievances);
router.get("/grievances/order/:quoteId", getMyGrievanceByOrder);
router.post("/grievances", validateBody(createGrievanceSchema), createMyGrievance);
router.post("/grievances/:id/messages", validateBody(addGrievanceMessageSchema), addMyGrievanceMessage);
router.post("/grievances/:id/resolve", resolveMyGrievance);
router.post("/requests", validateBody(createMyRequestSchema), createMyRequest);
router.get("/negotiations", listMyNegotiableQuotes);
router.post("/negotiations/:quoteId", validateBody(negotiateQuoteSchema), negotiateQuote);
router.post(
  "/recommendations/:recommendationId/accept",
  validateBody(acceptRecommendationSchema),
  acceptRecommendation
);
router.post("/recommendations/:recommendationId/decline", declineRecommendation);
router.get("/discount-reviews", listMyDiscountReviews);
router.get("/nav-alerts", getNavAlerts);
router.post(
  "/discount-reviews/:requestId/resolve",
  validateBody(resolveDiscountReviewSchema),
  resolveDiscountReview
);

export default router;
