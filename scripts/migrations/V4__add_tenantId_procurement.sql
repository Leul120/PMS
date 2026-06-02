-- ============================================================
-- Migration: Add tenantId to procurement-service tables
-- Database: procurementdb
-- ============================================================

ALTER TABLE "PurchaseRequisition"
    ADD COLUMN IF NOT EXISTS "tenantId" BIGINT;

UPDATE "PurchaseRequisition" SET "tenantId" = 1 WHERE "tenantId" IS NULL;

ALTER TABLE "PurchaseRequisition"
    ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pr_tenant_id     ON "PurchaseRequisition" ("tenantId");
CREATE INDEX IF NOT EXISTS idx_pr_tenant_status ON "PurchaseRequisition" ("tenantId", "status");

-- RequisitionItem
ALTER TABLE "RequisitionItem"
    ADD COLUMN IF NOT EXISTS "tenantId" BIGINT;

UPDATE "RequisitionItem" ri
SET    "tenantId" = pr."tenantId"
FROM   "PurchaseRequisition" pr
WHERE  ri."requisitionId" = pr."requisitionId"
AND    ri."tenantId" IS NULL;

UPDATE "RequisitionItem" SET "tenantId" = 1 WHERE "tenantId" IS NULL;

ALTER TABLE "RequisitionItem"
    ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_req_item_tenant_id ON "RequisitionItem" ("tenantId");

-- ApprovalHistory
ALTER TABLE "ApprovalHistory"
    ADD COLUMN IF NOT EXISTS "tenantId" BIGINT;

UPDATE "ApprovalHistory" ah
SET    "tenantId" = pr."tenantId"
FROM   "PurchaseRequisition" pr
WHERE  ah."requisitionId" = pr."requisitionId"
AND    ah."tenantId" IS NULL;

UPDATE "ApprovalHistory" SET "tenantId" = 1 WHERE "tenantId" IS NULL;

ALTER TABLE "ApprovalHistory"
    ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_approval_tenant_id ON "ApprovalHistory" ("tenantId");

-- PurchaseOrder
ALTER TABLE "PurchaseOrder"
    ADD COLUMN IF NOT EXISTS "tenantId" BIGINT;

UPDATE "PurchaseOrder" SET "tenantId" = 1 WHERE "tenantId" IS NULL;

ALTER TABLE "PurchaseOrder"
    ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_po_tenant_id     ON "PurchaseOrder" ("tenantId");
CREATE INDEX IF NOT EXISTS idx_po_tenant_status ON "PurchaseOrder" ("tenantId", "status");
