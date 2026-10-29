import { Router } from "express";
import {
  createClinicVisit,
  deleteClinicVisit,
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


router.get(
  "/:id",
  requireAuth,
  getClinicVisitById
);


router.post(
  "/",
  requireAuth,
  createClinicVisit
);

router.delete(
  "/:id",
  requireAuth,
  requireAdmin,
  deleteClinicVisit
);


export default router;
