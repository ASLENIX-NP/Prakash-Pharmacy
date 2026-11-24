-- Permanent credit settlement audit.
-- Additive migration: existing bills and their payment status remain unchanged.
-- Older settled bills will not receive invented historical audit records.

CREATE TABLE "credit_settlements_tbl" (
    "id" SERIAL NOT NULL,
    "bill_id" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_method" TEXT NOT NULL,
    "collected_by_id" TEXT NOT NULL,
    "settled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_settlements_tbl_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "credit_settlements_amount_positive_check"
        CHECK ("amount" > 0),
    CONSTRAINT "credit_settlements_method_check"
        CHECK ("payment_method" IN ('cash', 'fonepay_qr', 'card'))
);

CREATE UNIQUE INDEX "credit_settlements_bill_id_key"
    ON "credit_settlements_tbl"("bill_id");

CREATE INDEX "credit_settlements_collected_by_id_idx"
    ON "credit_settlements_tbl"("collected_by_id");

CREATE INDEX "credit_settlements_settled_at_idx"
    ON "credit_settlements_tbl"("settled_at");

ALTER TABLE "credit_settlements_tbl"
    ADD CONSTRAINT "credit_settlements_bill_id_fkey"
    FOREIGN KEY ("bill_id")
    REFERENCES "bill_tbl"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "credit_settlements_tbl"
    ADD CONSTRAINT "credit_settlements_collected_by_id_fkey"
    FOREIGN KEY ("collected_by_id")
    REFERENCES "user_tbl"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
