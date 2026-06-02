-- ============================================================
-- Migration: Create Tenant table and add tenantId to auth-service tables
-- Database: authdb
-- ============================================================

-- Create Tenant table
CREATE TABLE IF NOT EXISTS "Tenant" (
    "tenantId"          BIGSERIAL PRIMARY KEY,
    "name"              VARCHAR(255) NOT NULL,
    "domain"            VARCHAR(255) NOT NULL UNIQUE,
    "status"            VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE' CHECK ("status" IN ('ACTIVE','SUSPENDED','TRIAL')),
    "subscriptionPlan"  VARCHAR(20)  NOT NULL DEFAULT 'BASIC'  CHECK ("subscriptionPlan" IN ('BASIC','PRO','ENTERPRISE')),
    "settings"          JSONB,
    "createdAt"         TIMESTAMP    NOT NULL DEFAULT NOW(),
    "updatedAt"         TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_domain ON "Tenant" ("domain");
CREATE INDEX IF NOT EXISTS idx_tenant_status ON "Tenant" ("status");

-- Insert default tenant for existing data
INSERT INTO "Tenant" ("name", "domain", "status", "subscriptionPlan", "settings", "createdAt", "updatedAt")
VALUES ('Default Organization', 'default', 'ACTIVE', 'ENTERPRISE', '{"currency":"USD","timezone":"UTC","maxUsers":1000}', NOW(), NOW())
ON CONFLICT ("domain") DO NOTHING;

-- Add tenantId column to User table
ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "tenantId" BIGINT;

-- Back-fill existing users to the default tenant
UPDATE "User" u
SET    "tenantId" = (SELECT "tenantId" FROM "Tenant" WHERE "domain" = 'default')
WHERE  u."tenantId" IS NULL;

-- Make column non-nullable after back-fill
ALTER TABLE "User"
    ALTER COLUMN "tenantId" SET NOT NULL;

-- Add FK constraint
ALTER TABLE "User"
    ADD CONSTRAINT fk_user_tenant
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT;

-- Composite indexes
CREATE INDEX IF NOT EXISTS idx_user_tenant_id    ON "User" ("tenantId");
CREATE INDEX IF NOT EXISTS idx_user_tenant_email ON "User" ("tenantId", "email");
