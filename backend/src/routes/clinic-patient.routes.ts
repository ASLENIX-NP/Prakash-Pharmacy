import { Router } from "express";
import {
  createClinicPatient,
  getClinicPatientById,
  getClinicPatients,
  updateClinicPatient,
} from "../controllers/clinic-patient.controller.js";
import {
  requireAuth,
} from "../middleware/auth.middleware.js";

const router = Router();


// All authenticated clinic/pharmacy staff
// can search and register OPD patients.

router.get(
  "/",
  requireAuth,
  getClinicPatients
);

router.get(
  "/:id",
  requireAuth,
  getClinicPatientById
);

router.post(
  "/",
  requireAuth,
  createClinicPatient
);

router.put(
  "/:id",
  requireAuth,
  updateClinicPatient
);

export default router;
