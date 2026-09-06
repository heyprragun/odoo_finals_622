import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticateToken } from "../middleware/authenticateToken";
import { authorizeRoles } from "../middleware/authorizeRoles";
import { validateBody } from "../middleware/validate";
import { emailInvoiceSchema } from "../validation/invoice.validation";
import {
  listInvoices,
  getInvoiceDetail,
  markInvoiceAsPaid,
  downloadInvoicePdf,
  emailInvoice,
} from "../controllers/invoice.controller";

const router = Router();

// Finance owns billing; Admin has oversight. Nobody else (including
// Manager/Sales Rep) gets invoice access - matches the frontend nav gating.
router.use(authenticateToken, authorizeRoles(Role.FINANCE, Role.ADMIN));

router.get("/", listInvoices);
router.get("/:id", getInvoiceDetail);
router.post("/:id/mark-paid", markInvoiceAsPaid);
router.get("/:id/pdf", downloadInvoicePdf);
router.post("/:id/email", validateBody(emailInvoiceSchema), emailInvoice);

export default router;
