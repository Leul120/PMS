-- ============================================================
-- Migration: Add tenantId to delivery-invoice-service tables
-- Database: deliverydb
-- ============================================================

ALTER TABLE "delivery"
    ADD COLUMN IF NOT EXISTS "tenantId" BIGINT;

UPDATE "delivery" SET "tenantId" = 1 WHERE "tenantId" IS NULL;

ALTER TABLE "delivery"
    ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_delivery_tenant_id  ON "delivery" ("tenantId");
CREATE INDEX IF NOT EXISTS idx_delivery_tenant_po  ON "delivery" ("tenantId", "poId");

ALTER TABLE "invoice"
    ADD COLUMN IF NOT EXISTS "tenantId" BIGINT;

UPDATE "invoice" SET "tenantId" = 1 WHERE "tenantId" IS NULL;

ALTER TABLE "invoice"
    ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoice_tenant_id ON "invoice" ("tenantId");
CREATE INDEX IF NOT EXISTS idx_invoice_tenant_po ON "invoice" ("tenantId", "poId");

ALTER TABLE "ThreeWayMatch"
    ADD COLUMN IF NOT EXISTS "tenantId" BIGINT;

UPDATE "ThreeWayMatch" SET "tenantId" = 1 WHERE "tenantId" IS NULL;

ALTER TABLE "ThreeWayMatch"
    ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_twm_tenant_id ON "ThreeWayMatch" ("tenantId");
CREATE INDEX IF NOT EXISTS idx_twm_tenant_po ON "ThreeWayMatch" ("tenantId", "poId");

ALTER TABLE "Dispute"
    ADD COLUMN IF NOT EXISTS "tenantId" BIGINT;

UPDATE "Dispute" SET "tenantId" = 1 WHERE "tenantId" IS NULL;

ALTER TABLE "Dispute"
    ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dispute_tenant_id ON "Dispute" ("tenantId");
CREATE INDEX IF NOT EXISTS idx_dispute_tenant_po ON "Dispute" ("tenantId", "poId");
