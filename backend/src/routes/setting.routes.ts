import { Router } from "express";
import { getSettings, updateSettings } from "../controllers/setting.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const router = Router();

// Retrieve store settings (Public / Staff / Admin)
router.get("/", getSettings);

// Update store settings (Admin only)
router.put("/", requireAuth, requireAdmin, updateSettings);

export default router;
