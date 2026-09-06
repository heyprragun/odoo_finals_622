import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticateToken } from "../middleware/authenticateToken";
import { authorizeRoles } from "../middleware/authorizeRoles";
import { validateBody } from "../middleware/validate";
import { createQuoteSchema, markStockUnavailableSchema, updateQuoteSchema } from "../validation/quote.validation";
import {
  listMyQuotes,
  getQuote,
  createQuote,
  updateQuote,
  submitQuote,
  markStockUnavailable,
  deleteQuote,
} from "../controllers/quote.controller";

const router = Router();

router.use(authenticateToken);

// MANAGER, FINANCE and ADMIN get read-only visibility into every quote
// (their own "Quotations" screen mirrors the Sales Rep's) - only SALES_REP
// can create/edit/submit. CUSTOMER's own read-only portal is a future route.
router.get("/", authorizeRoles(Role.SALES_REP, Role.MANAGER, Role.FINANCE, Role.ADMIN), listMyQuotes);
router.get("/:id", authorizeRoles(Role.SALES_REP, Role.MANAGER, Role.FINANCE, Role.ADMIN), getQuote);
router.post("/", authorizeRoles(Role.SALES_REP), validateBody(createQuoteSchema), createQuote);
router.put("/:id", authorizeRoles(Role.SALES_REP), validateBody(updateQuoteSchema), updateQuote);
router.post("/:id/submit", authorizeRoles(Role.SALES_REP), submitQuote);
router.post(
  "/:id/mark-stock-unavailable",
  authorizeRoles(Role.SALES_REP),
  validateBody(markStockUnavailableSchema),
  markStockUnavailable
);
router.delete("/:id", authorizeRoles(Role.SALES_REP), deleteQuote);

export default router;
