-- Add age precision fields used by the current Clinic / OPD code.
-- Existing historical age fields remain unchanged.

ALTER TABLE "clinic_patients_tbl"
    ADD COLUMN IF NOT EXISTS "age_months" INTEGER,
    ADD COLUMN IF NOT EXISTS "age_unit" TEXT DEFAULT 'years';

ALTER TABLE "clinic_visits_tbl"
    ADD COLUMN IF NOT EXISTS "age_months_at_visit" INTEGER,
    ADD COLUMN IF NOT EXISTS "age_unit_at_visit" TEXT DEFAULT 'years';