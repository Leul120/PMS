-- ============================================================
-- Migration: Add tenantId to scoring-service tables
-- Database: scoringdb
-- ============================================================

ALTER TABLE "vendor_score"
    ADD COLUMN IF NOT EXISTS "tenantId" BIGINT;

UPDATE "vendor_score" SET "tenantId" = 1 WHERE "tenantId" IS NULL;

ALTER TABLE "vendor_score"
    ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vendor_score_tenant_id     ON "vendor_score" ("tenantId");
CREATE INDEX IF NOT EXISTS idx_vendor_score_tenant_vendor ON "vendor_score" ("tenantId", "vendorId");

ALTER TABLE "vendor_performance_record"
    ADD COLUMN IF NOT EXISTS "tenantId" BIGINT;

UPDATE "vendor_performance_record" SET "tenantId" = 1 WHERE "tenantId" IS NULL;

ALTER TABLE "vendor_performance_record"
    ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_perf_tenant_id     ON "vendor_performance_record" ("tenantId");
CREATE INDEX IF NOT EXISTS idx_perf_tenant_vendor ON "vendor_performance_record" ("tenantId", "vendorId");

ALTER TABLE "VendorCompositeScore"
    ADD COLUMN IF NOT EXISTS "tenantId" BIGINT;

UPDATE "VendorCompositeScore" SET "tenantId" = 1 WHERE "tenantId" IS NULL;

ALTER TABLE "VendorCompositeScore"
    ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_composite_tenant_id     ON "VendorCompositeScore" ("tenantId");
CREATE INDEX IF NOT EXISTS idx_composite_tenant_vendor ON "VendorCompositeScore" ("tenantId", "vendorId");

ALTER TABLE "ScoringWeights"
    ADD COLUMN IF NOT EXISTS "tenantId" BIGINT;

UPDATE "ScoringWeights" SET "tenantId" = 1 WHERE "tenantId" IS NULL;

ALTER TABLE "ScoringWeights"
    ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scoring_weights_tenant_id ON "ScoringWeights" ("tenantId");
