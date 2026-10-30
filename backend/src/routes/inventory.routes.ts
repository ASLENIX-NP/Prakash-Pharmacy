import {
  adjustInventoryStock,
  getInventoryAdjustmentLogs,
  getAllStockAdjustmentLogs,
} from "../controllers/inventoryAdjustment.controller.js";
﻿import { Router } from "express";
import {
  getAllInventory,
  getInventoryById,
  createInventory,
  updateInventory,
  deleteInventory,
  getInventorySummary,
} from "../controllers/inventory.controller.js";
import {
  getNearExpiryInventory,
  bulkImportInventory,
} from "../controllers/inventoryAdvanced.controller.js";
import {
  requireAuth,
  requireAdmin,
} from "../middleware/auth.middleware.js";

const router = Router();


// ==========================================================
// SUMMARY / ALERTS
// ==========================================================

router.get(
  "/alerts/summary",
  requireAuth,
  getInventorySummary
);

router.get(
  "/alerts/near-expiry",
  requireAuth,
  getNearExpiryInventory
);


// ==========================================================
// BULK INVENTORY IMPORT
// ==========================================================

router.post(
  "/bulk",
  requireAuth,
  requireAdmin,
  bulkImportInventory
);


// ==========================================================
// INVENTORY LIST / DETAILS
// ==========================================================

router.get(
  "/",
  requireAuth,
  getAllInventory
);

router.get(
  "/adjustments",
  requireAuth,
  requireAdmin,
  getAllStockAdjustmentLogs
);

router.get(
  "/:id/adjustments",
  requireAuth,
  requireAdmin,
  getInventoryAdjustmentLogs
);

router.post(
  "/:id/adjust",
  requireAuth,
  requireAdmin,
  adjustInventoryStock
);

router.get(
  "/:id",
  requireAuth,
  getInventoryById
);


// ==========================================================
// INVENTORY CREATE / UPDATE / DELETE
// ==========================================================

router.post(
  "/",
  requireAuth,
  requireAdmin,
  createInventory
);

router.put(
  "/:id",
  requireAuth,
  requireAdmin,
  updateInventory
);

router.delete(
  "/:id",
  requireAuth,
  requireAdmin,
  deleteInventory
);

export default router;
