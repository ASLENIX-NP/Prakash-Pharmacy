-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "generic_tbl" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "generic_tbl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_tbl" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "category_tbl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rack_tbl" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "rack_tbl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distributor_returns_tbl" (
    "id" SERIAL NOT NULL,
    "distributor_id" INTEGER NOT NULL,
    "debit_note_number" TEXT NOT NULL,
    "return_date" TIMESTAMP(3) NOT NULL,
    "items" JSONB NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "distributor_returns_tbl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_tbl" (
    "id" SERIAL NOT NULL,
    "medicine_brand" TEXT NOT NULL,
    "batch_number" TEXT NOT NULL,
    "expiry_date" TEXT NOT NULL,
    "generic_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "rack_id" INTEGER,
    "distributor_id" INTEGER,
    "unit_per_pack" INTEGER NOT NULL DEFAULT 10,
    "pack_in_stock" INTEGER NOT NULL DEFAULT 0,
    "unit_in_stock" INTEGER NOT NULL DEFAULT 0,
    "pack_alert_level" INTEGER NOT NULL DEFAULT 15,
    "cost_price" DECIMAL(10,2) NOT NULL,
    "selling_price" DECIMAL(10,2) NOT NULL,
    "hasvat" BOOLEAN NOT NULL DEFAULT false,
    "barcode" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_tbl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_tbl" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "initials" TEXT,
    "email" TEXT,
    "phone_number" TEXT,
    "role" TEXT NOT NULL DEFAULT 'staff',
    "shift" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_tbl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_tbl" (
    "id" SERIAL NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "customer_pan" TEXT,
    "prescribing_doctor" TEXT,
    "payment_method" TEXT NOT NULL DEFAULT 'cash',
    "payment_status" TEXT NOT NULL DEFAULT 'paid',
    "sub_total" DECIMAL(12,2) NOT NULL,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "vat_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "grand_total" DECIMAL(12,2) NOT NULL,
    "amount_received" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "change_returned" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "cashier_id" TEXT NOT NULL,

    CONSTRAINT "bill_tbl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_items" (
    "id" SERIAL NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "inventory_id" INTEGER NOT NULL,
    "quantity_in_pack" INTEGER NOT NULL DEFAULT 0,
    "quantity_in_unit" INTEGER NOT NULL DEFAULT 0,
    "pack_price" DECIMAL(10,2) NOT NULL,
    "vatitem_price" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "gross_item_price" DECIMAL(12,2) NOT NULL,
    "net_item_price" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "bill_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_wise_sales_report_tbl" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "medicine_count" INTEGER NOT NULL DEFAULT 0,
    "packets_count" INTEGER NOT NULL DEFAULT 0,
    "units_count" INTEGER NOT NULL DEFAULT 0,
    "cost_valuation" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "sale_valuation" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "gross_margin" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_wise_sales_report_tbl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distributors_tbl" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "pannumber" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "contact_person" TEXT,
    "credit_limit" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "current_balance" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "distributors_tbl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_tbl" (
    "id" SERIAL NOT NULL,
    "distributor_id" INTEGER,
    "invoice_id" INTEGER,
    "date_of_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "ledger_type" TEXT NOT NULL,
    "reference_no" TEXT,
    "debit_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "credit_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0.00,

    CONSTRAINT "ledger_tbl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustment_logs_tbl" (
    "id" SERIAL NOT NULL,
    "medicineId" INTEGER NOT NULL,
    "adjustmentType" TEXT NOT NULL,
    "previousPacks" INTEGER NOT NULL,
    "newPacks" INTEGER NOT NULL,
    "variancePacks" INTEGER NOT NULL,
    "previousLooseUnits" INTEGER NOT NULL,
    "newLooseUnits" INTEGER NOT NULL,
    "varianceLooseUnits" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_adjustment_logs_tbl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoice_tbl" (
    "id" SERIAL NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "distributor_id" INTEGER NOT NULL,
    "purchase_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_mode" TEXT NOT NULL DEFAULT 'credit',
    "due_date" TIMESTAMP(3),
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "taxable_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "vat_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "grand_total" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_invoice_tbl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoice_items_tbl" (
    "id" SERIAL NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "inventory_id" INTEGER,
    "medicine_name" TEXT NOT NULL,
    "generic_name" TEXT,
    "category_name" TEXT,
    "batch_number" TEXT NOT NULL,
    "expiry_date" TEXT NOT NULL,
    "pack_qty" INTEGER NOT NULL,
    "loose_units" INTEGER NOT NULL DEFAULT 0,
    "free_packs" INTEGER NOT NULL DEFAULT 0,
    "units_per_pack" INTEGER NOT NULL DEFAULT 10,
    "cost_price" DECIMAL(10,2) NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "is_vat_applicable" BOOLEAN NOT NULL DEFAULT false,
    "mrp_price" DECIMAL(10,2) NOT NULL,
    "rack_location" TEXT,
    "line_total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "purchase_invoice_items_tbl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_settings_tbl" (
    "id" SERIAL NOT NULL,
    "store_name" TEXT NOT NULL DEFAULT 'Prakash Pharmacy',
    "address" TEXT NOT NULL DEFAULT '',
    "phone_number" TEXT NOT NULL DEFAULT '',
    "email_id" TEXT NOT NULL DEFAULT '',
    "pan_number" TEXT NOT NULL DEFAULT '',
    "dda_licence_number" TEXT NOT NULL DEFAULT '',
    "vat_registered" BOOLEAN NOT NULL DEFAULT true,
    "store_logo" TEXT,
    "pharmacist_name" TEXT NOT NULL DEFAULT '',
    "pharmacist_council_reg_number" TEXT NOT NULL DEFAULT '',
    "dda_licence_expiry_date" TEXT NOT NULL DEFAULT '',
    "currency" TEXT NOT NULL DEFAULT 'NPR',
    "fiscal_year" TEXT NOT NULL DEFAULT '2081/82',
    "invoice_prefix" TEXT NOT NULL DEFAULT 'PP-2081/82-',
    "next_invoice_number" INTEGER NOT NULL DEFAULT 101,
    "default_invoice_size" TEXT NOT NULL DEFAULT 'A5',
    "invoice_date_format" TEXT NOT NULL DEFAULT 'BS',
    "receipt_footer_note" TEXT NOT NULL DEFAULT 'Thank you for your visit. Medicines once sold cannot be returned without original bill.',
    "default_low_stock_threshold" INTEGER NOT NULL DEFAULT 15,
    "near_expiry_threshold_months" INTEGER NOT NULL DEFAULT 6,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pharmacy_settings_tbl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_doctors_tbl" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "speciality" TEXT,
    "qualification" TEXT,
    "nmc_number" TEXT,
    "default_consultation_fee" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinic_doctors_tbl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_patients_tbl" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "gender" TEXT,
    "age_years" INTEGER,
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinic_patients_tbl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_visits_tbl" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "doctor_id" INTEGER NOT NULL,
    "created_by_id" TEXT,
    "visit_date_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "age_at_visit" INTEGER,
    "consultation_fee" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "additional_charge" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "additional_charge_note" TEXT,
    "total_charge" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "charge_note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "voided_at" TIMESTAMP(3),
    "void_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinic_visits_tbl_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "generic_tbl_name_key" ON "generic_tbl"("name");

-- CreateIndex
CREATE UNIQUE INDEX "category_tbl_name_key" ON "category_tbl"("name");

-- CreateIndex
CREATE UNIQUE INDEX "rack_tbl_name_key" ON "rack_tbl"("name");

-- CreateIndex
CREATE UNIQUE INDEX "distributor_returns_tbl_debit_note_number_key" ON "distributor_returns_tbl"("debit_note_number");

-- CreateIndex
CREATE INDEX "distributor_returns_tbl_distributor_id_idx" ON "distributor_returns_tbl"("distributor_id");

-- CreateIndex
CREATE INDEX "distributor_returns_tbl_return_date_idx" ON "distributor_returns_tbl"("return_date");

-- CreateIndex
CREATE INDEX "inventory_tbl_medicine_brand_idx" ON "inventory_tbl"("medicine_brand");

-- CreateIndex
CREATE INDEX "inventory_tbl_generic_id_idx" ON "inventory_tbl"("generic_id");

-- CreateIndex
CREATE INDEX "inventory_tbl_category_id_idx" ON "inventory_tbl"("category_id");

-- CreateIndex
CREATE INDEX "inventory_tbl_rack_id_idx" ON "inventory_tbl"("rack_id");

-- CreateIndex
CREATE INDEX "inventory_tbl_batch_number_idx" ON "inventory_tbl"("batch_number");

-- CreateIndex
CREATE INDEX "inventory_tbl_distributor_id_idx" ON "inventory_tbl"("distributor_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_tbl_username_key" ON "user_tbl"("username");

-- CreateIndex
CREATE UNIQUE INDEX "bill_tbl_invoice_number_key" ON "bill_tbl"("invoice_number");

-- CreateIndex
CREATE INDEX "bill_tbl_invoice_number_idx" ON "bill_tbl"("invoice_number");

-- CreateIndex
CREATE INDEX "bill_tbl_transaction_date_idx" ON "bill_tbl"("transaction_date");

-- CreateIndex
CREATE INDEX "bill_tbl_cashier_id_idx" ON "bill_tbl"("cashier_id");

-- CreateIndex
CREATE INDEX "bill_items_invoice_id_idx" ON "bill_items"("invoice_id");

-- CreateIndex
CREATE INDEX "bill_items_inventory_id_idx" ON "bill_items"("inventory_id");

-- CreateIndex
CREATE INDEX "category_wise_sales_report_tbl_category_id_idx" ON "category_wise_sales_report_tbl"("category_id");

-- CreateIndex
CREATE INDEX "ledger_tbl_distributor_id_idx" ON "ledger_tbl"("distributor_id");

-- CreateIndex
CREATE INDEX "ledger_tbl_date_of_creation_idx" ON "ledger_tbl"("date_of_creation");

-- CreateIndex
CREATE INDEX "stock_adjustment_logs_tbl_medicineId_idx" ON "stock_adjustment_logs_tbl"("medicineId");

-- CreateIndex
CREATE INDEX "stock_adjustment_logs_tbl_createdAt_idx" ON "stock_adjustment_logs_tbl"("createdAt");

-- CreateIndex
CREATE INDEX "purchase_invoice_tbl_invoice_number_idx" ON "purchase_invoice_tbl"("invoice_number");

-- CreateIndex
CREATE INDEX "purchase_invoice_tbl_distributor_id_idx" ON "purchase_invoice_tbl"("distributor_id");

-- CreateIndex
CREATE INDEX "purchase_invoice_tbl_purchase_date_idx" ON "purchase_invoice_tbl"("purchase_date");

-- CreateIndex
CREATE INDEX "purchase_invoice_items_tbl_invoice_id_idx" ON "purchase_invoice_items_tbl"("invoice_id");

-- CreateIndex
CREATE INDEX "purchase_invoice_items_tbl_inventory_id_idx" ON "purchase_invoice_items_tbl"("inventory_id");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_doctors_tbl_nmc_number_key" ON "clinic_doctors_tbl"("nmc_number");

-- CreateIndex
CREATE INDEX "clinic_doctors_tbl_name_idx" ON "clinic_doctors_tbl"("name");

-- CreateIndex
CREATE INDEX "clinic_doctors_tbl_status_idx" ON "clinic_doctors_tbl"("status");

-- CreateIndex
CREATE INDEX "clinic_patients_tbl_name_idx" ON "clinic_patients_tbl"("name");

-- CreateIndex
CREATE INDEX "clinic_patients_tbl_phone_idx" ON "clinic_patients_tbl"("phone");

-- CreateIndex
CREATE INDEX "clinic_visits_tbl_patient_id_idx" ON "clinic_visits_tbl"("patient_id");

-- CreateIndex
CREATE INDEX "clinic_visits_tbl_doctor_id_idx" ON "clinic_visits_tbl"("doctor_id");

-- CreateIndex
CREATE INDEX "clinic_visits_tbl_created_by_id_idx" ON "clinic_visits_tbl"("created_by_id");

-- CreateIndex
CREATE INDEX "clinic_visits_tbl_visit_date_time_idx" ON "clinic_visits_tbl"("visit_date_time");

-- AddForeignKey
ALTER TABLE "distributor_returns_tbl" ADD CONSTRAINT "distributor_returns_tbl_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "distributors_tbl"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_tbl" ADD CONSTRAINT "inventory_tbl_generic_id_fkey" FOREIGN KEY ("generic_id") REFERENCES "generic_tbl"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_tbl" ADD CONSTRAINT "inventory_tbl_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category_tbl"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_tbl" ADD CONSTRAINT "inventory_tbl_rack_id_fkey" FOREIGN KEY ("rack_id") REFERENCES "rack_tbl"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_tbl" ADD CONSTRAINT "inventory_tbl_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "distributors_tbl"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_tbl" ADD CONSTRAINT "bill_tbl_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "user_tbl"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "bill_tbl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "inventory_tbl"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_wise_sales_report_tbl" ADD CONSTRAINT "category_wise_sales_report_tbl_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category_tbl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_tbl" ADD CONSTRAINT "ledger_tbl_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "distributors_tbl"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_logs_tbl" ADD CONSTRAINT "stock_adjustment_logs_tbl_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "inventory_tbl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_tbl" ADD CONSTRAINT "purchase_invoice_tbl_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "distributors_tbl"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_items_tbl" ADD CONSTRAINT "purchase_invoice_items_tbl_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "purchase_invoice_tbl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_items_tbl" ADD CONSTRAINT "purchase_invoice_items_tbl_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "inventory_tbl"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_visits_tbl" ADD CONSTRAINT "clinic_visits_tbl_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "clinic_patients_tbl"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_visits_tbl" ADD CONSTRAINT "clinic_visits_tbl_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "clinic_doctors_tbl"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_visits_tbl" ADD CONSTRAINT "clinic_visits_tbl_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_tbl"("id") ON DELETE SET NULL ON UPDATE CASCADE;
