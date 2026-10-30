-- Phase 2A-3 medicine-safety state.
-- Keeps recalled/quarantined physical stock in inventory while making its sale state explicit.
ALTER TABLE "inventory_tbl"
  ADD COLUMN "sale_status" TEXT NOT NULL DEFAULT 'SELLABLE',
  ADD COLUMN "safety_reason" TEXT,
  ADD COLUMN "safety_changed_at" TIMESTAMP(3),
  ADD COLUMN "safety_changed_by" TEXT;

ALTER TABLE "inventory_tbl"
  ADD CONSTRAINT "inventory_tbl_sale_status_check"
  CHECK ("sale_status" IN ('SELLABLE', 'QUARANTINED', 'RECALLED'));

CREATE TABLE "inventory_safety_status_logs_tbl" (
  "id" SERIAL NOT NULL,
  "medicine_id" INTEGER NOT NULL,
  "previous_status" TEXT NOT NULL,
  "new_status" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "recorded_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_safety_status_logs_tbl_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inventory_safety_status_logs_tbl_medicine_id_idx"
  ON "inventory_safety_status_logs_tbl"("medicine_id");
CREATE INDEX "inventory_safety_status_logs_tbl_created_at_idx"
  ON "inventory_safety_status_logs_tbl"("created_at");

ALTER TABLE "inventory_safety_status_logs_tbl"
  ADD CONSTRAINT "inventory_safety_status_logs_tbl_medicine_id_fkey"
  FOREIGN KEY ("medicine_id") REFERENCES "inventory_tbl"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
