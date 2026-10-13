import { Router } from "express";
import {
  createBill,
  getAllBills,
  getBillById,
  getBillingSummary,
} from "../controllers/bill.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

// Financial metrics & daily summary
router.get("/summary/daily", requireAuth, getBillingSummary);

// Sales list & detail lookup
router.get("/", requireAuth, getAllBills);
router.get("/:id", requireAuth, getBillById);

// Create new Bill / Tax Invoice (Cashier / POS checkout)
router.post("/", requireAuth, createBill);

export default router;
