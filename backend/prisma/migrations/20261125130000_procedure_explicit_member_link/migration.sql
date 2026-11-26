-- Additive FK: only bills explicitly confirmed as members have a customer_id.
-- Existing bills remain unchanged with NULL customer_id.
ALTER TABLE "clinic_procedure_invoices_tbl"
  ADD COLUMN "customer_id" INTEGER;

CREATE INDEX "clinic_procedure_invoices_tbl_customer_id_idx"
  ON "clinic_procedure_invoices_tbl"("customer_id");

ALTER TABLE "clinic_procedure_invoices_tbl"
  ADD CONSTRAINT "clinic_procedure_invoices_tbl_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers_tbl"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
