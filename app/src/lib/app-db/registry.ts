/**
 * App Database Registry — manages database scopes for AI-created dashboards.
 *
 * Each dashboard can optionally have a database scope:
 *   - 1 user schema (shared across all dashboards of the same user)
 *   - 1 table prefix per dashboard (unique, immutable)
 *   - N tables within that prefix
 *
 * Status machine: draft → active → deleting → deleted
 *                 draft → orphaned (TTL cleanup)
 *
 * The registry lives in Postgres (Prisma-managed) and is the authoritative
 * source for database metadata. Firestore dashboard docs get a summary
 * `appDatabase` block for the UI.
 */

import { prisma } from "@/lib/prisma";
import { userSchemaName, dashboardTablePrefix } from "./naming";
import type { AppDbInstance, Prisma } from "@/generated/prisma/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export type InstanceStatus = "draft" | "active" | "deleting" | "deleted" | "orphaned";

export interface CreateInstanceInput {
  dashboardId: string;
  ownerUid: string;
  ownerEmail: string;
}

export interface TableColumnDef {
  name: string;
  type: string;
  nullable?: boolean;
  defaultValue?: string;
}

export interface RegisterTableInput {
  instanceId: string;
  dashboardId: string;
  tableName: string;       // physical name
  logicalName: string;     // friendly name
  columns: TableColumnDef[];
}

// ─── Instance CRUD ───────────────────────────────────────────────────────────

/**
 * Create a draft database instance for a dashboard.
 * Idempotent: returns existing instance if dashboardId already registered.
 */
export async function createDraftInstance(input: CreateInstanceInput): Promise<AppDbInstance> {
  const existing = await prisma.appDbInstance.findUnique({
    where: { dashboardId: input.dashboardId },
  });

  if (existing) {
    if (existing.status === "deleted" || existing.status === "orphaned") {
      // Reclaim: update back to draft
      return prisma.appDbInstance.update({
        where: { id: existing.id },
        data: {
          status: "draft",
          ownerUid: input.ownerUid,
          ownerEmail: input.ownerEmail,
          updatedAt: new Date(),
        },
      });
    }
    return existing;
  }

  const schema = userSchemaName(input.ownerUid);
  const prefix = dashboardTablePrefix(input.dashboardId);

  return prisma.appDbInstance.create({
    data: {
      dashboardId: input.dashboardId,
      ownerUid: input.ownerUid,
      ownerEmail: input.ownerEmail,
      userSchema: schema,
      tablePrefix: prefix,
      status: "draft",
    },
  });
}

/**
 * Re-key an instance to a different dashboard ID.
 * Used when a draft was provisioned with a temp ID but the dashboard
 * is saved under a different (existing) ID in edit mode.
 */
export async function rekeyInstance(oldDashboardId: string, newDashboardId: string): Promise<AppDbInstance | null> {
  const instance = await prisma.appDbInstance.findUnique({
    where: { dashboardId: oldDashboardId },
  });
  if (!instance) return null;

  // Also update dashboardId in related tables, migrations, audits
  await prisma.$transaction([
    prisma.appDbInstance.update({
      where: { id: instance.id },
      data: { dashboardId: newDashboardId, updatedAt: new Date() },
    }),
    prisma.appDbTable.updateMany({
      where: { instanceId: instance.id },
      data: { dashboardId: newDashboardId },
    }),
    prisma.appDbMigration.updateMany({
      where: { instanceId: instance.id },
      data: { dashboardId: newDashboardId },
    }),
    prisma.appDbAudit.updateMany({
      where: { instanceId: instance.id },
      data: { dashboardId: newDashboardId },
    }),
  ]);

  return prisma.appDbInstance.findUnique({ where: { dashboardId: newDashboardId } });
}

/**
 * Activate an instance (draft → active). Called when dashboard is saved.
 */
export async function activateInstance(dashboardId: string): Promise<AppDbInstance | null> {
  const instance = await prisma.appDbInstance.findUnique({
    where: { dashboardId },
  });
  if (!instance || (instance.status !== "draft" && instance.status !== "active")) {
    return null;
  }
  if (instance.status === "active") return instance;

  return prisma.appDbInstance.update({
    where: { id: instance.id },
    data: { status: "active", updatedAt: new Date() },
  });
}

/**
 * Mark instance for deletion (active → deleting).
 */
export async function markForDeletion(dashboardId: string): Promise<AppDbInstance | null> {
  const instance = await prisma.appDbInstance.findUnique({
    where: { dashboardId },
  });
  if (!instance) return null;
  if (instance.status === "deleted" || instance.status === "deleting") return instance;

  return prisma.appDbInstance.update({
    where: { id: instance.id },
    data: { status: "deleting", updatedAt: new Date() },
  });
}

/**
 * Finalize deletion (deleting → deleted).
 */
export async function finalizeDeleted(dashboardId: string): Promise<void> {
  await prisma.appDbInstance.updateMany({
    where: { dashboardId, status: "deleting" },
    data: { status: "deleted", updatedAt: new Date() },
  });
}

/**
 * Get instance by dashboard ID. Returns null if not found.
 */
export async function getInstance(dashboardId: string): Promise<AppDbInstance | null> {
  return prisma.appDbInstance.findUnique({ where: { dashboardId } });
}

/**
 * Get instance with all tables.
 */
export async function getInstanceWithTables(dashboardId: string) {
  return prisma.appDbInstance.findUnique({
    where: { dashboardId },
    include: { tables: { orderBy: { createdAt: "asc" } } },
  });
}

/**
 * Find stale instances that need cleanup:
 * - draft instances older than TTL (abandoned by user)
 * - deleting instances older than TTL (failed cleanup during dashboard deletion)
 */
export async function findOrphanedDrafts(olderThanMs: number = 24 * 60 * 60 * 1000) {
  const cutoff = new Date(Date.now() - olderThanMs);
  return prisma.appDbInstance.findMany({
    where: {
      status: { in: ["draft", "deleting"] },
      updatedAt: { lt: cutoff },
    },
  });
}

/**
 * Mark drafts as orphaned.
 */
export async function markOrphaned(instanceIds: string[]): Promise<void> {
  if (instanceIds.length === 0) return;
  await prisma.appDbInstance.updateMany({
    where: { id: { in: instanceIds } },
    data: { status: "orphaned", updatedAt: new Date() },
  });
}

// ─── Table Registry ──────────────────────────────────────────────────────────

/**
 * Register a table in the registry.
 */
export async function registerTable(input: RegisterTableInput) {
  return prisma.appDbTable.create({
    data: {
      instanceId: input.instanceId,
      dashboardId: input.dashboardId,
      tableName: input.tableName,
      logicalName: input.logicalName,
      columns: input.columns as unknown as Prisma.InputJsonValue,
    },
  });
}

/**
 * Update column metadata for a table (after ADD COLUMN etc.).
 */
export async function updateTableColumns(tableId: string, columns: TableColumnDef[], schemaVersion: number) {
  return prisma.appDbTable.update({
    where: { id: tableId },
    data: {
      columns: columns as unknown as Prisma.InputJsonValue,
      schemaVersion,
      updatedAt: new Date(),
    },
  });
}

/**
 * Get tables for an instance.
 */
export async function getInstanceTables(instanceId: string) {
  return prisma.appDbTable.findMany({
    where: { instanceId },
    orderBy: { createdAt: "asc" },
  });
}

// ─── Audit ───────────────────────────────────────────────────────────────────

/**
 * Record an audit entry.
 */
export async function recordAudit(input: {
  instanceId: string;
  dashboardId: string;
  ownerUid: string;
  operationType: string;
  tableName?: string;
  rowCount?: number;
  payloadSummary?: string;
  executedBy?: string;
}) {
  return prisma.appDbAudit.create({
    data: {
      instanceId: input.instanceId,
      dashboardId: input.dashboardId,
      ownerUid: input.ownerUid,
      operationType: input.operationType,
      tableName: input.tableName ?? null,
      rowCount: input.rowCount ?? null,
      payloadSummary: input.payloadSummary?.slice(0, 500) ?? null,
      executedBy: input.executedBy ?? "agent",
    },
  });
}

/**
 * Record a migration entry.
 */
export async function recordMigration(input: {
  instanceId: string;
  dashboardId: string;
  tableName: string;
  operation: string;
  details: Record<string, unknown>;
}) {
  return prisma.appDbMigration.create({
    data: {
      instanceId: input.instanceId,
      dashboardId: input.dashboardId,
      tableName: input.tableName,
      operation: input.operation,
      details: input.details as unknown as Prisma.InputJsonValue,
    },
  });
}

// ─── Firestore Summary ───────────────────────────────────────────────────────

/**
 * Build the `appDatabase` summary block to store in Firestore dashboard doc.
 */
export function buildFirestoreSummary(instance: AppDbInstance & { tables?: Array<{ logicalName: string }> }) {
  return {
    enabled: true,
    dashboardId: instance.dashboardId,
    userSchema: instance.userSchema,
    tablePrefix: instance.tablePrefix,
    tables: (instance.tables ?? []).map((t) => t.logicalName),
    status: instance.status,
    lastMigrationAt: instance.updatedAt.toISOString(),
  };
}
