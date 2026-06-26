-- Baseline migration: captures existing schema from prisma db push
-- This migration is marked as already applied via prisma migrate resolve

-- Persistent Fields (existing before #124)
CREATE TABLE IF NOT EXISTS "DashboardFieldSchema" (
    "id" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DashboardFieldSchema_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DashboardFieldValue" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DashboardFieldValue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DashboardFieldAudit" (
    "id" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedBy" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DashboardFieldAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DashboardFieldSchema_dashboardId_key_key" ON "DashboardFieldSchema"("dashboardId", "key");
CREATE INDEX IF NOT EXISTS "DashboardFieldSchema_dashboardId_idx" ON "DashboardFieldSchema"("dashboardId");
CREATE UNIQUE INDEX IF NOT EXISTS "DashboardFieldValue_fieldId_key" ON "DashboardFieldValue"("fieldId");
CREATE INDEX IF NOT EXISTS "DashboardFieldAudit_dashboardId_idx" ON "DashboardFieldAudit"("dashboardId");
CREATE INDEX IF NOT EXISTS "DashboardFieldAudit_dashboardId_fieldKey_idx" ON "DashboardFieldAudit"("dashboardId", "fieldKey");

ALTER TABLE "DashboardFieldValue" ADD CONSTRAINT "DashboardFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "DashboardFieldSchema"("id") ON DELETE CASCADE ON UPDATE CASCADE;
