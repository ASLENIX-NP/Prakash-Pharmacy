-- Phase 2A-4 audit hardening: persist actor attribution on supplier and purchase
-- financial records, and retain a durable snapshot when a purchase is cancelled.

ALTER TABLE "distributor_returns_tbl"
  ADD COLUMN IF NOT EXISTS "recorded_by" TEXT;

ALTER TABLE "ledger_tbl"
  ADD COLUMN IF NOT EXISTS "recorded_by" TEXT;

ALTER TABLE "purchase_invoice_tbl"
  ADD COLUMN IF NOT EXISTS "created_by" TEXT;

CREATE TABLE IF NOT EXISTS "purchase_cancellation_logs_tbl" (
  "id" SERIAL PRIMARY KEY,
  "purchase_id" INTEGER NOT NULL,
  "invoice_number" TEXT NOT NULL,
  "distributor_id" INTEGER NOT NULL,
  "payment_mode" TEXT NOT NULL,
  "grand_total" DECIMAL(12,2) NOT NULL,
  "reason" TEXT,
  "cancelled_by" TEXT NOT NULL,
  "cancelled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "purchase_snapshot" JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS "purchase_cancellation_logs_tbl_purchase_id_idx"
  ON "purchase_cancellation_logs_tbl"("purchase_id");
CREATE INDEX IF NOT EXISTS "purchase_cancellation_logs_tbl_invoice_number_idx"
  ON "purchase_cancellation_logs_tbl"("invoice_number");
CREATE INDEX IF NOT EXISTS "purchase_cancellation_logs_tbl_cancelled_at_idx"
  ON "purchase_cancellation_logs_tbl"("cancelled_at");
