import { Router } from "express";
import {
  createDoctor,
  deactivateDoctor,
  getAllDoctors,
  getDoctorById,
  updateDoctor,
} from "../controllers/doctor.controller.js";
import {
  requireAdmin,
  requireAuth,
} from "../middleware/auth.middleware.js";

const router = Router();

// Staff + Admin can read active doctors for OPD entry.
router.get(
  "/",
  requireAuth,
  getAllDoctors
);

router.get(
  "/:id",
  requireAuth,
  getDoctorById
);

// Admin doctor management.
router.post(
  "/",
  requireAuth,
  requireAdmin,
  createDoctor
);

router.put(
  "/:id",
  requireAuth,
  requireAdmin,
  updateDoctor
);

router.delete(
  "/:id",
  requireAuth,
  requireAdmin,
  deactivateDoctor
);

export default router;
