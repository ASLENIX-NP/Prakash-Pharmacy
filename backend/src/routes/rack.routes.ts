import { Router } from "express";
import {
  getAllRacks,
  getRackById,
  createRack,
  updateRack,
  deleteRack,
} from "../controllers/rack.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const router = Router();

// Read racks: available to all authenticated users (staff + admin)
router.get("/", requireAuth, getAllRacks);
router.get("/:id", requireAuth, getRackById);

// Admin-only management
router.post("/", requireAuth, requireAdmin, createRack);
router.put("/:id", requireAuth, requireAdmin, updateRack);
router.delete("/:id", requireAuth, requireAdmin, deleteRack);

export default router;
