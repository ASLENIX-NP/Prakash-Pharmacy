import { Router } from "express";
import {
  getAllDistributors,
  getDistributorById,
  createDistributor,
  updateDistributor,
  deleteDistributor,
  getDistributorLedger,
  recordDistributorPayment,
  recordDistributorReturn,
  getDistributorReturns,
} from "../controllers/distributor.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const router = Router();

// Read distributors & ledgers (Staff + Admin)
router.get("/", requireAuth, requireAdmin, getAllDistributors);
router.get("/returns/history", requireAuth, requireAdmin, getDistributorReturns);
router.get("/:id", requireAuth, requireAdmin, getDistributorById);
router.get("/:id/ledger", requireAuth, requireAdmin, getDistributorLedger);

// Management & Payments (Admin only)
router.post("/", requireAuth, requireAdmin, createDistributor);
router.put("/:id", requireAuth, requireAdmin, updateDistributor);
router.delete("/:id", requireAuth, requireAdmin, deleteDistributor);
router.post("/:id/payments", requireAuth, requireAdmin, recordDistributorPayment);
router.post("/:id/returns", requireAuth, requireAdmin, recordDistributorReturn);

export default router;
