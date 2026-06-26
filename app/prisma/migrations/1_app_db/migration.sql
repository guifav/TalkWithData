-- Issue #124: App Database isolation per user/dashboard

CREATE TABLE "AppDbInstance" (
    "id" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "ownerUid" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "userSchema" TEXT NOT NULL,
    "tablePrefix" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppDbInstance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppDbTable" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "logicalName" TEXT NOT NULL,
    "columns" JSONB NOT NULL DEFAULT '[]',
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppDbTable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppDbMigration" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AppDbMigration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppDbAudit" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "ownerUid" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "tableName" TEXT,
    "rowCount" INTEGER,
    "payloadSummary" TEXT,
    "executedBy" TEXT NOT NULL DEFAULT 'agent',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AppDbAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppDbInstance_dashboardId_key" ON "AppDbInstance"("dashboardId");
CREATE INDEX "AppDbInstance_ownerUid_idx" ON "AppDbInstance"("ownerUid");
CREATE INDEX "AppDbInstance_status_idx" ON "AppDbInstance"("status");

CREATE UNIQUE INDEX "AppDbTable_instanceId_logicalName_key" ON "AppDbTable"("instanceId", "logicalName");
CREATE INDEX "AppDbTable_dashboardId_idx" ON "AppDbTable"("dashboardId");

CREATE INDEX "AppDbMigration_dashboardId_idx" ON "AppDbMigration"("dashboardId");

CREATE INDEX "AppDbAudit_dashboardId_idx" ON "AppDbAudit"("dashboardId");
CREATE INDEX "AppDbAudit_ownerUid_idx" ON "AppDbAudit"("ownerUid");
CREATE INDEX "AppDbAudit_createdAt_idx" ON "AppDbAudit"("createdAt");

ALTER TABLE "AppDbTable" ADD CONSTRAINT "AppDbTable_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "AppDbInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppDbMigration" ADD CONSTRAINT "AppDbMigration_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "AppDbInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppDbAudit" ADD CONSTRAINT "AppDbAudit_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "AppDbInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
