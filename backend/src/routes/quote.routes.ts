import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticateToken } from "../middleware/authenticateToken";
import { authorizeRoles } from "../middleware/authorizeRoles";
import { validateBody } from "../middleware/validate";
import { createQuoteSchema, updateQuoteSchema } from "../validation/quote.validation";
import {
  listMyQuotes,
  getQuote,
  createQuote,
  updateQuote,
  submitQuote,
} from "../controllers/quote.controller";

const router = Router();

// SALES_REP only in this phase. Manager/Finance approval views and CUSTOMER's
// own read-only visibility are separate future phases with their own routes.
router.use(authenticateToken, authorizeRoles(Role.SALES_REP));

router.get("/", listMyQuotes);
router.get("/:id", getQuote);
router.post("/", validateBody(createQuoteSchema), createQuote);
router.put("/:id", validateBody(updateQuoteSchema), updateQuote);
router.post("/:id/submit", submitQuote);

export default router;
