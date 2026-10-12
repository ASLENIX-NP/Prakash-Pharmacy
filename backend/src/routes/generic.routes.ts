import { Router } from "express";
import {
  getAllGenerics,
  createGeneric,
  updateGeneric,
  deleteGeneric,
} from "../controllers/generic.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, getAllGenerics);
router.post("/", requireAuth, createGeneric);
router.put("/:id", requireAuth, requireAdmin, updateGeneric);
router.delete("/:id", requireAuth, requireAdmin, deleteGeneric);

export default router;
