import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticateToken } from "../middleware/authenticateToken";
import { authorizeRoles } from "../middleware/authorizeRoles";
import {
  getTeamDirectory,
  getOrdersOverview,
  getProductPerformance,
  getCustomerTierOverview,
  getCustomerDetail,
  getSalesInsights,
  exportReport,
} from "../controllers/reports.controller";

const router = Router();

// Admin Reports section - every endpoint here is company-wide data (every
// Sales Rep's quotes, every customer, every product), which is why it's
// Admin-only rather than reusing any of the role-scoped views elsewhere.
router.use(authenticateToken, authorizeRoles(Role.ADMIN));

router.get("/team", getTeamDirectory);
router.get("/orders", getOrdersOverview);
router.get("/products", getProductPerformance);
router.get("/customers", getCustomerTierOverview);
router.get("/customers/:customerId", getCustomerDetail);
router.get("/ai-insights", getSalesInsights);
router.get("/export", exportReport);

export default router;
