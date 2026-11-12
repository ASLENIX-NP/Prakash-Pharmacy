-- Optional doctor photo column. Existing data is preserved.
ALTER TABLE "clinic_doctors_tbl" ADD COLUMN IF NOT EXISTS "photo_data" TEXT;
