import { Router } from "express";
import {
  getAllInventory,
  getInventoryById,
  createInventory,
  updateInventory,
  deleteInventory,
  getInventorySummary,
} from "../controllers/inventory.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const router = Router();

// Summary and Alerts
router.get("/alerts/summary", requireAuth, getInventorySummary);

// Inventory list & details
router.get("/", requireAuth, getAllInventory);
router.get("/:id", requireAuth, getInventoryById);

// Modifications
router.post("/", requireAuth, createInventory);
router.put("/:id", requireAuth, updateInventory);
router.delete("/:id", requireAuth, requireAdmin, deleteInventory);

export default router;
