-- Preserve medicine safety audit history while allowing the related
-- inventory row to be removed during legitimate deletion / QA cleanup.

ALTER TABLE "inventory_safety_status_logs_tbl"
  DROP CONSTRAINT IF EXISTS "inventory_safety_status_logs_tbl_medicine_id_fkey";

ALTER TABLE "inventory_safety_status_logs_tbl"
  ALTER COLUMN "medicine_id" DROP NOT NULL;

ALTER TABLE "inventory_safety_status_logs_tbl"
  ADD CONSTRAINT "inventory_safety_status_logs_tbl_medicine_id_fkey"
  FOREIGN KEY ("medicine_id")
  REFERENCES "inventory_tbl"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
