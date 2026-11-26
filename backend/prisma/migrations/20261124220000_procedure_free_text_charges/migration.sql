-- Allow handwritten procedure descriptions and per-bill prices.
-- Keep existing catalog and historical invoice links unchanged.
ALTER TABLE "clinic_procedure_invoice_items_tbl"
  ALTER COLUMN "service_id" DROP NOT NULL;
