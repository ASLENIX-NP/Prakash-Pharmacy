import { Router } from "express";
import { getVatReportSummary, getFullBackup } from "../controllers/report.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const router = Router();

router.get(
  "/vat-summary",
  requireAuth,
  requireAdmin,
  getVatReportSummary
);

router.get(
  "/backup",
  requireAuth,
  requireAdmin,
  getFullBackup
);

export default router;
