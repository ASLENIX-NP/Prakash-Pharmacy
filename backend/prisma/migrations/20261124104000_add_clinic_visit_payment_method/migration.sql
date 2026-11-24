-- Add payment_method to clinic_visits_tbl
ALTER TABLE "clinic_visits_tbl"
    ADD COLUMN IF NOT EXISTS "payment_method" TEXT DEFAULT 'cash';
