import { Router } from "express";
import { getVatReportSummary } from "../controllers/report.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.get(
  "/vat-summary",
  requireAuth,
  getVatReportSummary
);

export default router;
