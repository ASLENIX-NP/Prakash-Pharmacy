-- CreateTable
CREATE TABLE "sales_returns_tbl" (
    "id" SERIAL NOT NULL,
    "credit_note_number" TEXT NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "return_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refund_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "reason" TEXT,
    "recorded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_returns_tbl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_return_items_tbl" (
    "id" SERIAL NOT NULL,
    "return_id" INTEGER NOT NULL,
    "bill_item_id" INTEGER NOT NULL,
    "inventory_id" INTEGER NOT NULL,
    "quantity_in_pack" INTEGER NOT NULL DEFAULT 0,
    "quantity_in_unit" INTEGER NOT NULL DEFAULT 0,
    "refund_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,

    CONSTRAINT "sales_return_items_tbl_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_returns_tbl_credit_note_number_key" ON "sales_returns_tbl"("credit_note_number");

-- CreateIndex
CREATE INDEX "sales_returns_tbl_invoice_id_idx" ON "sales_returns_tbl"("invoice_id");

-- CreateIndex
CREATE INDEX "sales_returns_tbl_return_date_idx" ON "sales_returns_tbl"("return_date");

-- CreateIndex
CREATE INDEX "sales_return_items_tbl_return_id_idx" ON "sales_return_items_tbl"("return_id");

-- CreateIndex
CREATE INDEX "sales_return_items_tbl_bill_item_id_idx" ON "sales_return_items_tbl"("bill_item_id");

-- CreateIndex
CREATE INDEX "sales_return_items_tbl_inventory_id_idx" ON "sales_return_items_tbl"("inventory_id");

-- AddForeignKey
ALTER TABLE "sales_returns_tbl" ADD CONSTRAINT "sales_returns_tbl_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "bill_tbl"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_items_tbl" ADD CONSTRAINT "sales_return_items_tbl_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "sales_returns_tbl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_items_tbl" ADD CONSTRAINT "sales_return_items_tbl_bill_item_id_fkey" FOREIGN KEY ("bill_item_id") REFERENCES "bill_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_items_tbl" ADD CONSTRAINT "sales_return_items_tbl_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "inventory_tbl"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
