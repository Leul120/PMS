-- ============================================================
-- Migration: Add tenantId to inventory-service tables
-- Database: inventorydb
-- ============================================================

ALTER TABLE "inventory_items"
    ADD COLUMN IF NOT EXISTS "tenantId" BIGINT;

UPDATE "inventory_items" SET "tenantId" = 1 WHERE "tenantId" IS NULL;

ALTER TABLE "inventory_items"
    ALTER COLUMN "tenantId" SET NOT NULL;

-- itemCode was globally unique; make it unique per tenant instead
ALTER TABLE "inventory_items"
    DROP CONSTRAINT IF EXISTS inventory_items_itemcode_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_tenant_code ON "inventory_items" ("tenantId", "itemCode");

CREATE INDEX IF NOT EXISTS idx_inventory_tenant_id   ON "inventory_items" ("tenantId");
CREATE INDEX IF NOT EXISTS idx_inventory_tenant_code ON "inventory_items" ("tenantId", "itemCode");
