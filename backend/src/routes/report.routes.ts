import { Router } from "express";
import { getVatReportSummary } from "../controllers/report.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const router = Router();

router.get(
  "/vat-summary",
  requireAuth,
  requireAdmin,
  getVatReportSummary
);

export default router;
