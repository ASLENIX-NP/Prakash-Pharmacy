-- Add pharmacist procedures as separate fully-paid invoices; no changes to OPD/POS data.
BEGIN;
CREATE TABLE "clinic_procedure_services_tbl" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "default_fee" DECIMAL(12,2) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "clinic_procedure_services_tbl_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "clinic_procedure_service_fee_check" CHECK ("default_fee" >= 0)
);
CREATE UNIQUE INDEX "clinic_procedure_services_tbl_name_key" ON "clinic_procedure_services_tbl"("name");

CREATE TABLE "clinic_procedure_invoices_tbl" (
  "id" SERIAL NOT NULL,
  "client_request_id" TEXT NOT NULL,
  "patient_id" INTEGER,
  "patient_name" TEXT NOT NULL,
  "patient_phone" TEXT,
  "payment_method" TEXT NOT NULL,
  "total_amount" DECIMAL(12,2) NOT NULL,
  "notes" TEXT,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinic_procedure_invoices_tbl_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "clinic_procedure_invoice_total_check" CHECK ("total_amount" > 0),
  CONSTRAINT "clinic_procedure_invoice_method_check" CHECK ("payment_method" IN ('cash','fonepay_qr','card'))
);
CREATE UNIQUE INDEX "clinic_procedure_invoices_tbl_client_request_id_key" ON "clinic_procedure_invoices_tbl"("client_request_id");
CREATE INDEX "clinic_procedure_invoices_tbl_patient_id_idx" ON "clinic_procedure_invoices_tbl"("patient_id");
CREATE INDEX "clinic_procedure_invoices_tbl_created_at_idx" ON "clinic_procedure_invoices_tbl"("created_at");
CREATE INDEX "clinic_procedure_invoices_tbl_patient_phone_idx" ON "clinic_procedure_invoices_tbl"("patient_phone");
ALTER TABLE "clinic_procedure_invoices_tbl"
  ADD CONSTRAINT "clinic_procedure_invoices_tbl_patient_id_fkey"
  FOREIGN KEY ("patient_id") REFERENCES "clinic_patients_tbl"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clinic_procedure_invoices_tbl"
  ADD CONSTRAINT "clinic_procedure_invoices_tbl_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "user_tbl"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "clinic_procedure_invoice_items_tbl" (
  "id" SERIAL NOT NULL,
  "invoice_id" INTEGER NOT NULL,
  "service_id" INTEGER NOT NULL,
  "service_name" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unit_fee" DECIMAL(12,2) NOT NULL,
  "line_total" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "clinic_procedure_invoice_items_tbl_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "clinic_procedure_item_quantity_check" CHECK ("quantity" BETWEEN 1 AND 20),
  CONSTRAINT "clinic_procedure_item_fee_check" CHECK ("unit_fee" >= 0),
  CONSTRAINT "clinic_procedure_item_total_check" CHECK ("line_total" >= 0)
);
CREATE INDEX "clinic_procedure_invoice_items_tbl_invoice_id_idx" ON "clinic_procedure_invoice_items_tbl"("invoice_id");
CREATE INDEX "clinic_procedure_invoice_items_tbl_service_id_idx" ON "clinic_procedure_invoice_items_tbl"("service_id");
ALTER TABLE "clinic_procedure_invoice_items_tbl"
  ADD CONSTRAINT "clinic_procedure_invoice_items_tbl_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "clinic_procedure_invoices_tbl"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clinic_procedure_invoice_items_tbl"
  ADD CONSTRAINT "clinic_procedure_invoice_items_tbl_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "clinic_procedure_services_tbl"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
COMMIT;
