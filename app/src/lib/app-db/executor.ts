/**
 * App Database Tool Executor — handles tool calls from the AI agent.
 *
 * Each tool call is scoped to a specific dashboard's database context.
 * The executor resolves schema/prefix from the registry and executes
 * the operation, recording audit entries for all mutations.
 *
 * The model NEVER provides schema, prefix, or ownerUid — these are
 * resolved from the authenticated session context.
 */

import {
  getInstance,
  getInstanceWithTables,
  registerTable,
  updateTableColumns,
  recordAudit,
  recordMigration,
  type TableColumnDef,
} from "./registry";
// Local type to avoid strict import issues in Docker builds where
// Prisma client may not be fully generated yet during type checking.
interface AppDbTableRow {
  logicalName: string;
  tableName: string;
  columns: unknown;
  schemaVersion: number;
}
import {
  ensureUserSchema,
  createTable,
  addColumns,
  listTablesInSchema,
  describeTable,
  readRows,
  insertRows,
  updateRows,
  deleteRows,
} from "./schema-manager";
import { sanitizeIdentifier } from "./naming";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DbContext {
  dashboardId: string;
  ownerUid: string;
  ownerEmail: string;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ─── Main Executor ───────────────────────────────────────────────────────────

/**
 * Execute an app-db tool call within the given context.
 */
export async function executeAppDbTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: DbContext
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case "ensure_dashboard_database":
        return await handleEnsure(ctx);
      case "describe_dashboard_database":
        return await handleDescribe(ctx);
      case "create_dashboard_table":
        return await handleCreateTable(args, ctx);
      case "add_dashboard_columns":
        return await handleAddColumns(args, ctx);
      case "list_dashboard_tables":
        return await handleListTables(ctx);
      case "read_dashboard_rows":
        return await handleReadRows(args, ctx);
      case "insert_dashboard_rows":
        return await handleInsertRows(args, ctx);
      case "update_dashboard_rows":
        return await handleUpdateRows(args, ctx);
      case "delete_dashboard_rows":
        return await handleDeleteRows(args, ctx);
      default:
        return { success: false, error: `Unknown app-db tool: ${toolName}` };
    }
  } catch (err) {
    console.error(`[AppDb] Tool ${toolName} failed:`, err);
    return {
      success: false,
      error: `Database operation failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Tool Handlers ───────────────────────────────────────────────────────────

async function handleEnsure(ctx: DbContext): Promise<ToolResult> {
  const instance = await getInstance(ctx.dashboardId);
  if (!instance) {
    return {
      success: false,
      error: "No database scope found for this dashboard. Call provision-draft first.",
    };
  }

  // Ensure schema exists
  await ensureUserSchema(instance.userSchema);

  // List existing tables
  // Get registered table metadata
  const instanceWithTables = await getInstanceWithTables(ctx.dashboardId);
  const registeredTables = (instanceWithTables?.tables ?? []).map((t: AppDbTableRow) => ({
    logicalName: t.logicalName,
    columns: t.columns,
    schemaVersion: t.schemaVersion,
  }));

  return {
    success: true,
    data: {
      status: instance.status,
      // Note: userSchema and tablePrefix are NOT exposed to the model
      tableCount: registeredTables.length,
      tables: registeredTables.map((t) => ({
        logicalName: t.logicalName,
        columns: t.columns,
        schemaVersion: t.schemaVersion,
      })),
    },
  };
}

async function handleDescribe(ctx: DbContext): Promise<ToolResult> {
  const instance = await getInstanceWithTables(ctx.dashboardId);
  if (!instance) {
    return { success: false, error: "No database scope found for this dashboard." };
  }

  const tableDetails = [];
  for (const table of instance.tables) {
    try {
      const columns = await describeTable(instance.userSchema, table.tableName);
      const stats = await listTablesInSchema(instance.userSchema, instance.tablePrefix);
      const rowCount = stats.find((s) => s.tableName === table.tableName)?.rowCount ?? 0;

      tableDetails.push({
        logicalName: table.logicalName,
        schemaVersion: table.schemaVersion,
        rowCount,
        columns: columns.map((c) => ({
          name: c.column_name,
          type: c.data_type,
          nullable: c.is_nullable === "YES",
          default: c.column_default,
        })),
      });
    } catch (err) {
      tableDetails.push({
        logicalName: table.logicalName,
        error: `Failed to describe: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return {
    success: true,
    data: {
      status: instance.status,
      tableCount: instance.tables.length,
      tables: tableDetails,
    },
  };
}

async function handleCreateTable(args: Record<string, unknown>, ctx: DbContext): Promise<ToolResult> {
  const instance = await getInstance(ctx.dashboardId);
  if (!instance) {
    return { success: false, error: "No database scope found." };
  }

  const logicalName = args.logical_name as string;
  if (!logicalName) {
    return { success: false, error: "logical_name is required" };
  }

  const safeName = sanitizeIdentifier(logicalName);
  if (!safeName) {
    return { success: false, error: `Invalid table name: "${logicalName}". Use only a-z, 0-9, underscore.` };
  }

  const columns = (args.columns as TableColumnDef[]) || [];

  // Create table in Postgres
  const { physicalName, allColumns } = await createTable(
    instance.userSchema,
    instance.tablePrefix,
    safeName,
    columns
  );

  // Register in registry
  await registerTable({
    instanceId: instance.id,
    dashboardId: ctx.dashboardId,
    tableName: physicalName,
    logicalName: safeName,
    columns: allColumns,
  });

  // Record migration + audit
  await recordMigration({
    instanceId: instance.id,
    dashboardId: ctx.dashboardId,
    tableName: physicalName,
    operation: "create_table",
    details: { logicalName: safeName, columns: allColumns },
  });
  await recordAudit({
    instanceId: instance.id,
    dashboardId: ctx.dashboardId,
    ownerUid: ctx.ownerUid,
    operationType: "create_table",
    tableName: physicalName,
    payloadSummary: `Created table ${safeName} with ${allColumns.length} columns`,
  });

  return {
    success: true,
    data: {
      logicalName: safeName,
      columns: allColumns,
    },
  };
}

async function handleAddColumns(args: Record<string, unknown>, ctx: DbContext): Promise<ToolResult> {
  const instance = await getInstanceWithTables(ctx.dashboardId);
  if (!instance) {
    return { success: false, error: "No database scope found." };
  }

  const logicalName = sanitizeIdentifier(args.table_name as string);
  if (!logicalName) {
    return { success: false, error: "table_name is required" };
  }

  const table = instance.tables.find((t) => t.logicalName === logicalName);
  if (!table) {
    return { success: false, error: `Table "${logicalName}" not found in this dashboard.` };
  }

  const newColumns = (args.columns as TableColumnDef[]) || [];
  if (newColumns.length === 0) {
    return { success: false, error: "columns array is required and must not be empty" };
  }

  // Add columns in Postgres
  await addColumns(instance.userSchema, table.tableName, newColumns);

  // Update registry (deduplicate: skip columns already in registry AND within this request)
  const existingColumns = (table.columns as unknown as TableColumnDef[]) || [];
  const existingNames = new Set(existingColumns.map((c) => c.name));
  const seenInRequest = new Set<string>();
  const trulyNew = newColumns.filter((c) => {
    const safeName = sanitizeIdentifier(c.name);
    if (!safeName || existingNames.has(safeName) || seenInRequest.has(safeName)) return false;
    seenInRequest.add(safeName);
    return true;
  });
  if (trulyNew.length === 0) {
    // All columns already exist — idempotent no-op for registry
    return {
      success: true,
      data: { logicalName, addedColumns: 0, message: "All columns already exist" },
    };
  }
  const mergedColumns = [...existingColumns, ...trulyNew];
  await updateTableColumns(table.id, mergedColumns, table.schemaVersion + 1);

  // Record migration + audit
  await recordMigration({
    instanceId: instance.id,
    dashboardId: ctx.dashboardId,
    tableName: table.tableName,
    operation: "add_columns",
    details: { addedColumns: newColumns },
  });
  await recordAudit({
    instanceId: instance.id,
    dashboardId: ctx.dashboardId,
    ownerUid: ctx.ownerUid,
    operationType: "alter_table",
    tableName: table.tableName,
    payloadSummary: `Added ${newColumns.length} column(s) to ${logicalName}`,
  });

  return {
    success: true,
    data: {
      logicalName,
      addedColumns: newColumns.length,
      newSchemaVersion: table.schemaVersion + 1,
    },
  };
}

async function handleListTables(ctx: DbContext): Promise<ToolResult> {
  const instance = await getInstanceWithTables(ctx.dashboardId);
  if (!instance) {
    return { success: false, error: "No database scope found." };
  }

  const physicalTables = await listTablesInSchema(instance.userSchema, instance.tablePrefix);

  const tables = instance.tables.map((t: AppDbTableRow) => {
    const physical = physicalTables.find((p) => p.tableName === t.tableName);
    return {
      logicalName: t.logicalName,
      rowCount: physical?.rowCount ?? 0,
      schemaVersion: t.schemaVersion,
    };
  });

  return { success: true, data: { tables } };
}

async function handleReadRows(args: Record<string, unknown>, ctx: DbContext): Promise<ToolResult> {
  const instance = await getInstanceWithTables(ctx.dashboardId);
  if (!instance) {
    return { success: false, error: "No database scope found." };
  }

  const logicalName = sanitizeIdentifier(args.table_name as string);
  if (!logicalName) {
    return { success: false, error: "table_name is required" };
  }

  const table = instance.tables.find((t) => t.logicalName === logicalName);
  if (!table) {
    return { success: false, error: `Table "${logicalName}" not found.` };
  }

  const result = await readRows(instance.userSchema, table.tableName, {
    orderBy: args.order_by as string | undefined,
    orderDir: args.order_dir as "ASC" | "DESC" | undefined,
    limit: args.limit as number | undefined,
    offset: args.offset as number | undefined,
  });

  return {
    success: true,
    data: {
      table: logicalName,
      totalCount: result.totalCount,
      rowCount: result.rows.length,
      rows: result.rows,
    },
  };
}

async function handleInsertRows(args: Record<string, unknown>, ctx: DbContext): Promise<ToolResult> {
  const instance = await getInstanceWithTables(ctx.dashboardId);
  if (!instance) {
    return { success: false, error: "No database scope found." };
  }

  const logicalName = sanitizeIdentifier(args.table_name as string);
  if (!logicalName) {
    return { success: false, error: "table_name is required" };
  }

  const table = instance.tables.find((t) => t.logicalName === logicalName);
  if (!table) {
    return { success: false, error: `Table "${logicalName}" not found.` };
  }

  const rows = args.rows as Record<string, unknown>[];
  if (!Array.isArray(rows) || rows.length === 0) {
    return { success: false, error: "rows array is required and must not be empty" };
  }

  // Cap at 500 rows per call
  if (rows.length > 500) {
    return { success: false, error: "Maximum 500 rows per insert. Use multiple calls for larger batches." };
  }

  const inserted = await insertRows(instance.userSchema, table.tableName, rows);

  await recordAudit({
    instanceId: instance.id,
    dashboardId: ctx.dashboardId,
    ownerUid: ctx.ownerUid,
    operationType: "insert",
    tableName: table.tableName,
    rowCount: inserted,
    payloadSummary: `Inserted ${inserted} row(s) into ${logicalName}`,
  });

  return {
    success: true,
    data: { table: logicalName, insertedCount: inserted },
  };
}

async function handleUpdateRows(args: Record<string, unknown>, ctx: DbContext): Promise<ToolResult> {
  const instance = await getInstanceWithTables(ctx.dashboardId);
  if (!instance) {
    return { success: false, error: "No database scope found." };
  }

  const logicalName = sanitizeIdentifier(args.table_name as string);
  if (!logicalName) {
    return { success: false, error: "table_name is required" };
  }

  const table = instance.tables.find((t) => t.logicalName === logicalName);
  if (!table) {
    return { success: false, error: `Table "${logicalName}" not found.` };
  }

  const updates = args.updates as Array<{ id: string; data: Record<string, unknown> }>;
  if (!Array.isArray(updates) || updates.length === 0) {
    return { success: false, error: "updates array is required" };
  }

  if (updates.length > 500) {
    return { success: false, error: "Maximum 500 updates per call." };
  }

  const updated = await updateRows(instance.userSchema, table.tableName, updates);

  await recordAudit({
    instanceId: instance.id,
    dashboardId: ctx.dashboardId,
    ownerUid: ctx.ownerUid,
    operationType: "update",
    tableName: table.tableName,
    rowCount: updated,
    payloadSummary: `Updated ${updated} row(s) in ${logicalName}`,
  });

  return {
    success: true,
    data: { table: logicalName, updatedCount: updated },
  };
}

async function handleDeleteRows(args: Record<string, unknown>, ctx: DbContext): Promise<ToolResult> {
  const instance = await getInstanceWithTables(ctx.dashboardId);
  if (!instance) {
    return { success: false, error: "No database scope found." };
  }

  const logicalName = sanitizeIdentifier(args.table_name as string);
  if (!logicalName) {
    return { success: false, error: "table_name is required" };
  }

  const table = instance.tables.find((t) => t.logicalName === logicalName);
  if (!table) {
    return { success: false, error: `Table "${logicalName}" not found.` };
  }

  const ids = args.ids as string[];
  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: false, error: "ids array is required" };
  }

  if (ids.length > 500) {
    return { success: false, error: "Maximum 500 deletes per call." };
  }

  const deleted = await deleteRows(instance.userSchema, table.tableName, ids);

  await recordAudit({
    instanceId: instance.id,
    dashboardId: ctx.dashboardId,
    ownerUid: ctx.ownerUid,
    operationType: "delete",
    tableName: table.tableName,
    rowCount: deleted,
    payloadSummary: `Deleted ${deleted} row(s) from ${logicalName}`,
  });

  return {
    success: true,
    data: { table: logicalName, deletedCount: deleted },
  };
}
