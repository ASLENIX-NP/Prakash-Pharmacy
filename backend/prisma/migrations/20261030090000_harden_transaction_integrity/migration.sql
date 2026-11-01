-- Durable POS request idempotency key. A retry of the same checkout can
-- return the already-committed bill instead of deducting stock twice.
ALTER TABLE "bill_tbl"
  ADD COLUMN "client_request_id" TEXT;

CREATE UNIQUE INDEX "bill_tbl_client_request_id_key"
  ON "bill_tbl"("client_request_id");

-- Preserve immutable sale-time metadata so historical invoices and credit notes
-- do not change when live inventory metadata is edited later.
ALTER TABLE "bill_items"
  ADD COLUMN "medicine_name_snapshot" TEXT,
  ADD COLUMN "generic_name_snapshot" TEXT,
  ADD COLUMN "category_name_snapshot" TEXT,
  ADD COLUMN "batch_number_snapshot" TEXT,
  ADD COLUMN "expiry_date_snapshot" TEXT,
  ADD COLUMN "units_per_pack_snapshot" INTEGER,
  ADD COLUMN "cost_price_snapshot" DECIMAL(10,2),
  ADD COLUMN "has_vat_snapshot" BOOLEAN,
  ADD COLUMN "rack_location_snapshot" TEXT;

-- Independent, database-backed counter for concurrency-safe customer credit notes.
ALTER TABLE "pharmacy_settings_tbl"
  ADD COLUMN "next_credit_note_number" INTEGER NOT NULL DEFAULT 1;

-- Freeze the best available metadata for legacy bill lines at migration time.
-- This cannot reconstruct metadata that was already changed before this migration,
-- but it prevents any further historical drift after deployment.
UPDATE "bill_items" AS bi
   SET "medicine_name_snapshot" = i."medicine_brand",
       "generic_name_snapshot" = g."name",
       "category_name_snapshot" = c."name",
       "batch_number_snapshot" = i."batch_number",
       "expiry_date_snapshot" = i."expiry_date",
       "units_per_pack_snapshot" = i."unit_per_pack",
       "cost_price_snapshot" = i."cost_price",
       "has_vat_snapshot" = i."hasvat",
       "rack_location_snapshot" = r."name"
  FROM "inventory_tbl" AS i
  JOIN "generic_tbl" AS g ON g."id" = i."generic_id"
  JOIN "category_tbl" AS c ON c."id" = i."category_id"
  LEFT JOIN "rack_tbl" AS r ON r."id" = i."rack_id"
 WHERE bi."inventory_id" = i."id";

-- Seed both counters above every legacy number already issued. The previous
-- implementation generated invoice/credit-note sequences from table counts,
-- so an existing PharmacySetting row may still contain its untouched default.
UPDATE "pharmacy_settings_tbl"
   SET "next_invoice_number" = GREATEST(
         "next_invoice_number",
         COALESCE(
           (SELECT MAX(substring("invoice_number" from '([0-9]+)$')::INTEGER) + 1
              FROM "bill_tbl"
             WHERE "invoice_number" ~ '[0-9]+$'),
           "next_invoice_number"
         )
       ),
       "next_credit_note_number" = GREATEST(
         "next_credit_note_number",
         COALESCE(
           (SELECT MAX(substring("credit_note_number" from '([0-9]+)$')::INTEGER) + 1
              FROM "sales_returns_tbl"
             WHERE "credit_note_number" ~ '[0-9]+$'),
           "next_credit_note_number"
         )
       );


-- Stock-adjustment history is an audit trail. Inventory deletion must never
-- erase it through a cascading foreign key.
ALTER TABLE "stock_adjustment_logs_tbl"
  DROP CONSTRAINT "stock_adjustment_logs_tbl_medicineId_fkey";

ALTER TABLE "stock_adjustment_logs_tbl"
  ADD CONSTRAINT "stock_adjustment_logs_tbl_medicineId_fkey"
  FOREIGN KEY ("medicineId") REFERENCES "inventory_tbl"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;


-- Supplier invoice numbers must be unique per supplier. Fail loudly if legacy
-- duplicates need manual accounting reconciliation before this invariant can
-- be enabled.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM "purchase_invoice_tbl"
     GROUP BY "distributor_id", lower(trim("invoice_number"))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate supplier invoice numbers exist; reconcile them before applying transaction-integrity migration.';
  END IF;
END $$;

ALTER TABLE "purchase_invoice_tbl"
  ADD CONSTRAINT "purchase_invoice_supplier_invoice_unique"
  UNIQUE ("distributor_id", "invoice_number");

-- Preserve the application's case-insensitive supplier-invoice identity at the
-- database layer as well. The Prisma @@unique above remains useful for normal
-- client operations; this expression index closes the ABC-vs-abc race gap.
CREATE UNIQUE INDEX "purchase_invoice_supplier_invoice_ci_key"
  ON "purchase_invoice_tbl" ("distributor_id", lower(trim("invoice_number")));

-- The application treats medicine brand + batch as one physical inventory
-- batch case-insensitively. Enforce the same invariant in PostgreSQL.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM "inventory_tbl"
     GROUP BY lower(trim("medicine_brand")), lower(trim("batch_number"))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate medicine/batch inventory rows exist; reconcile them before applying transaction-integrity migration.';
  END IF;
END $$;

ALTER TABLE "inventory_tbl"
  ADD CONSTRAINT "inventory_medicine_batch_unique"
  UNIQUE ("medicine_brand", "batch_number");

-- Also enforce the case-insensitive medicine+batch identity used by the API.
CREATE UNIQUE INDEX "inventory_medicine_batch_ci_key"
  ON "inventory_tbl" (lower(trim("medicine_brand")), lower(trim("batch_number")));
