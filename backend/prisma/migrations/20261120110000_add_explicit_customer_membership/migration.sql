-- Explicit, admin-registered memberships. Existing customers stay non-members.
-- Safe additive columns; no old POS / OPD rows are changed.
BEGIN;
ALTER TABLE "customers_tbl" ADD COLUMN "membership_number" TEXT;
ALTER TABLE "customers_tbl" ADD COLUMN "member_since" TIMESTAMP(3);
CREATE UNIQUE INDEX "customers_tbl_membership_number_key" ON "customers_tbl"("membership_number");
COMMIT;