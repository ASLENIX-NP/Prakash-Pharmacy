-- Add custom_charge to purchase_invoice_tbl
ALTER TABLE "purchase_invoice_tbl"
    ADD COLUMN IF NOT EXISTS "custom_charge" DECIMAL(12, 2) DEFAULT 0.00;
