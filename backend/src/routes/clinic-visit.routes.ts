import { Router } from "express";
import {
  completeClinicVisit,
  createClinicVisit,
  getClinicVisitById,
  getClinicVisitReport,
  getClinicVisits,
} from "../controllers/clinic-visit.controller.js";
import {
  requireAdmin,
  requireAuth,
} from "../middleware/auth.middleware.js";

const router = Router();


// Staff + Admin can register and review OPD visits.
router.get(
  "/",
  requireAuth,
  getClinicVisits
);


// Revenue report is Admin only.
// IMPORTANT: Must stay before "/:id".
router.get(
  "/report",
  requireAuth,
  requireAdmin,
  getClinicVisitReport
);


// Staff + Admin can complete an OPEN OPD after consultation.
router.put(
  "/:id/complete",
  requireAuth,
  completeClinicVisit
);


router.get(
  "/:id",
  requireAuth,
  getClinicVisitById
);


// Registration creates an OPEN OPD.
// Sticker can be printed immediately after this call.
router.post(
  "/",
  requireAuth,
  createClinicVisit
);


export default router;
