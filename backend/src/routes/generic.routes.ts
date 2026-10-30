import { Router } from "express";
import {
  getAllGenerics,
  createGeneric,
  updateGeneric,
  deleteGeneric,
} from "../controllers/generic.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";
import {
  getGenericCatalog,
  getGenericDetails,
} from "../controllers/genericAdvanced.controller.js";

const router = Router();

router.get("/", requireAuth, getAllGenerics);

// Grouped inventory by generic composition.
router.get("/catalog", requireAuth, getGenericCatalog);

// One generic with all associated medicines/brands.
router.get("/:id/details", requireAuth, getGenericDetails);
router.post("/", requireAuth, requireAdmin, createGeneric);
router.put("/:id", requireAuth, requireAdmin, updateGeneric);
router.delete("/:id", requireAuth, requireAdmin, deleteGeneric);

export default router;
