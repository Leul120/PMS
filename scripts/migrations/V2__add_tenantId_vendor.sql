-- ============================================================
-- Migration: Add tenantId to vendor-service tables
-- Database: vendordb
-- ============================================================

-- Vendor
ALTER TABLE "Vendor"
    ADD COLUMN IF NOT EXISTS "tenantId" BIGINT;

UPDATE "Vendor" SET "tenantId" = 1 WHERE "tenantId" IS NULL;

ALTER TABLE "Vendor"
    ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vendor_tenant_id    ON "Vendor" ("tenantId");
CREATE INDEX IF NOT EXISTS idx_vendor_tenant_email ON "Vendor" ("tenantId", "email");

-- VendorDocument
ALTER TABLE "VendorDocument"
    ADD COLUMN IF NOT EXISTS "tenantId" BIGINT;

UPDATE "VendorDocument" SET "tenantId" = 1 WHERE "tenantId" IS NULL;

ALTER TABLE "VendorDocument"
    ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vendor_doc_tenant_id ON "VendorDocument" ("tenantId");
