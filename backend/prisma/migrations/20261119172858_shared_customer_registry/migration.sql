-- Shared customer registry for POS and OPD.
-- This migration preserves all existing bills and patients.
-- Historical records will be linked in a separate reviewed step.

BEGIN;

CREATE TABLE "customers_tbl" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_tbl_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customers_tbl_phone_key"
    ON "customers_tbl"("phone");

CREATE INDEX "customers_tbl_name_idx"
    ON "customers_tbl"("name");

ALTER TABLE "bill_tbl"
    ADD COLUMN "customer_id" INTEGER;

ALTER TABLE "clinic_patients_tbl"
    ADD COLUMN "customer_id" INTEGER;

CREATE INDEX "bill_tbl_customer_id_idx"
    ON "bill_tbl"("customer_id");

CREATE INDEX "clinic_patients_tbl_customer_id_idx"
    ON "clinic_patients_tbl"("customer_id");

ALTER TABLE "bill_tbl"
    ADD CONSTRAINT "bill_tbl_customer_id_fkey"
    FOREIGN KEY ("customer_id")
    REFERENCES "customers_tbl"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE "clinic_patients_tbl"
    ADD CONSTRAINT "clinic_patients_tbl_customer_id_fkey"
    FOREIGN KEY ("customer_id")
    REFERENCES "customers_tbl"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMIT;