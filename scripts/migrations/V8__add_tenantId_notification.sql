-- ============================================================
-- Migration: Add tenantId to notification-service tables
-- Database: notificationdb
-- ============================================================

ALTER TABLE "Notification"
    ADD COLUMN IF NOT EXISTS "tenantId" BIGINT;

UPDATE "Notification" SET "tenantId" = 1 WHERE "tenantId" IS NULL;

ALTER TABLE "Notification"
    ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_tenant_id   ON "Notification" ("tenantId");
CREATE INDEX IF NOT EXISTS idx_notification_tenant_user ON "Notification" ("tenantId", "userId");
