import { Router } from "express";
import {
  getAllPurchases,
  getPurchaseById,
  createPurchase,
} from "../controllers/purchase.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const router = Router();

// Read purchase invoices (Staff + Admin)
router.get("/", requireAuth, getAllPurchases);
router.get("/:id", requireAuth, getPurchaseById);

// Create new purchase inward bill (Admin only)
router.post("/", requireAuth, requireAdmin, createPurchase);

export default router;
