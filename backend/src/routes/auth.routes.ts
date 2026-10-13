import { Router } from "express";
import {
  login,
  getMe,
  forgotPassword,
  resetPassword,
} from "../controllers/auth.controller.js";
import {
  register,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
} from "../controllers/staff.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const router = Router();

// ==========================================
// Public Routes
// ==========================================
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// ==========================================
// Authenticated User Routes (Any role)
// ==========================================
router.get("/me", requireAuth, getMe);

// ==========================================
// Admin-Only Staff & User Management Routes
// ==========================================
router.post("/register", requireAuth, requireAdmin, register);
router.get("/users", requireAuth, requireAdmin, getAllUsers);
router.get("/users/:id", requireAuth, requireAdmin, getUserById);
router.put("/users/:id", requireAuth, requireAdmin, updateUser);
router.delete("/users/:id", requireAuth, requireAdmin, deleteUser);

export default router;
