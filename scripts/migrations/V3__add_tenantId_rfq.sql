-- ============================================================
-- Migration: Add tenantId to rfq-bidding-service tables
-- Database: rfqdb
-- ============================================================

ALTER TABLE "RFQ"
    ADD COLUMN IF NOT EXISTS "tenantId" BIGINT;

UPDATE "RFQ" SET "tenantId" = 1 WHERE "tenantId" IS NULL;

ALTER TABLE "RFQ"
    ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rfq_tenant_id     ON "RFQ" ("tenantId");
CREATE INDEX IF NOT EXISTS idx_rfq_tenant_status ON "RFQ" ("tenantId", "status");

ALTER TABLE "Bid"
    ADD COLUMN IF NOT EXISTS "tenantId" BIGINT;

UPDATE "Bid" SET "tenantId" = 1 WHERE "tenantId" IS NULL;

ALTER TABLE "Bid"
    ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bid_tenant_id  ON "Bid" ("tenantId");
CREATE INDEX IF NOT EXISTS idx_bid_tenant_rfq ON "Bid" ("tenantId", "rfqId");
