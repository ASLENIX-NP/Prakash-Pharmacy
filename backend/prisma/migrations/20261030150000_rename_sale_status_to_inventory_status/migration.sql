-- Phase 2A-3 compatibility hardening.
-- Keep the Prisma/API field named saleStatus while exposing a clear,
-- persistent inventory_status column at the database layer.

ALTER TABLE "inventory_tbl"
  RENAME COLUMN "sale_status" TO "inventory_status";

ALTER TABLE "inventory_tbl"
  RENAME CONSTRAINT "inventory_tbl_sale_status_check"
  TO "inventory_tbl_inventory_status_check";
