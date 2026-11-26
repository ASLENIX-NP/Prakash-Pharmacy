-- Additive soft-delete (void) columns for 30-day member retention.
ALTER TABLE "customers_tbl"
  ADD COLUMN "voided_at" TIMESTAMP(3),
  ADD COLUMN "void_reason" TEXT;

CREATE INDEX "customers_tbl_voided_at_idx"
  ON "customers_tbl"("voided_at");
