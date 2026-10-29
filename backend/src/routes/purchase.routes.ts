import { Router } from "express";
import {
  getAllPurchases,
  getPurchaseById,
  createPurchase,
  deletePurchase,
} from "../controllers/purchase.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const router = Router();

// Read purchase invoices (Staff + Admin)
router.get("/", requireAuth, requireAdmin, getAllPurchases);
router.get("/:id", requireAuth, requireAdmin, getPurchaseById);

// Create new purchase inward bill (Admin only)
router.post("/", requireAuth, requireAdmin, createPurchase);

// Cancel/Delete purchase inward bill & revert stock/ledger (Admin only)
router.delete("/:id", requireAuth, requireAdmin, deletePurchase);

export default router;
