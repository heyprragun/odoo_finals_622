import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticateToken } from "../middleware/authenticateToken";
import { authorizeRoles } from "../middleware/authorizeRoles";
import {
  listRecommendations,
  generateRecommendations,
  sendRecommendationToCustomer,
} from "../controllers/recommendation.controller";

// Mounted at /api/quotes/:quoteId/recommendations - mergeParams so
// req.params.quoteId (from the parent mount path) is visible here.
const router = Router({ mergeParams: true });

router.use(authenticateToken, authorizeRoles(Role.SALES_REP, Role.ADMIN));

router.get("/", listRecommendations);
router.post("/generate", generateRecommendations);
router.post("/:recommendationId/send-to-customer", sendRecommendationToCustomer);

export default router;
