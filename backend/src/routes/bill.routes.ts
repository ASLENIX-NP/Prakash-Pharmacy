import { Router } from "express";
import {
  createBill,
  getAllBills,
  getBillById,
  getBillingSummary,
  returnBillItems,
  getAllSalesReturns,
} from "../controllers/bill.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

// Financial metrics & daily summary
router.get("/summary/daily", requireAuth, getBillingSummary);

// Sales returns & credit notes list (MUST be before /:id)
router.get("/returns/history", requireAuth, getAllSalesReturns);
router.get("/returns", requireAuth, getAllSalesReturns);

// Sales list & detail lookup
router.get("/", requireAuth, getAllBills);
router.get("/:id", requireAuth, getBillById);

// Create new Bill / Tax Invoice (Cashier / POS checkout)
router.post("/", requireAuth, createBill);

// Sales return / customer refund
router.post("/:id/return", requireAuth, returnBillItems);

export default router;
