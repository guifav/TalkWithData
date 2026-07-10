/**
 * Schema Manager — raw SQL operations for user schemas and tables.
 *
 * This module executes DDL against the Cloud SQL instance.
 * All operations are scoped to a user's schema and a dashboard's table prefix.
 * No raw SQL is exposed to the AI agent — this is internal only.
 */

import { prisma } from "@/lib/prisma";
import {
  sanitizeIdentifier,
  sanitizeColumnName,
  physicalTableName,
  tableMatchesPrefix,
  COLUMN_TYPE_MAP,
} from "./naming";
import type { TableColumnDef } from "./registry";

// ─── Schema Operations ──────────────────────────────────────────────────────

/**
 * Ensure a user schema exists. Idempotent (IF NOT EXISTS).
 */
export async function ensureUserSchema(schemaName: string): Promise<void> {
  const safe = sanitizeIdentifier(schemaName);
  if (!safe || safe !== schemaName) {
    throw new Error(`Invalid schema name: "${schemaName}"`);
  }
  // Prisma.$executeRawUnsafe is needed for DDL with dynamic identifiers.
  // The schema name is pre-validated by sanitizeIdentifier (only [a-z0-9_]).
  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${safe}"`);
}

// ─── Table Operations ────────────────────────────────────────────────────────

/**
 * Create a table within a user's schema.
 *
 * Every table gets baseline columns: id (uuid PK), created_at, updated_at.
 * Additional columns are appended from the `columns` parameter.
 */
export async function createTable(
  schema: string,
  tablePrefix: string,
  logicalName: string,
  columns: TableColumnDef[]
): Promise<{ physicalName: string; allColumns: TableColumnDef[] }> {
  const safeSchema = sanitizeIdentifier(schema);
  const physName = physicalTableName(tablePrefix, logicalName);

  if (!safeSchema) throw new Error(`Invalid schema: "${schema}"`);

  // Build column definitions
  const colDefs: string[] = [
    `"id" UUID PRIMARY KEY DEFAULT gen_random_uuid()`,
    `"created_at" TIMESTAMPTZ NOT NULL DEFAULT now()`,
    `"updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()`,
  ];

  const allColumns: TableColumnDef[] = [
    { name: "id", type: "uuid", nullable: false },
    { name: "created_at", type: "timestamp", nullable: false },
    { name: "updated_at", type: "timestamp", nullable: false },
  ];

  for (const col of columns) {
    const safeName = sanitizeColumnName(col.name);
    if (!safeName) throw new Error(`Invalid column name: "${col.name}"`);
    if (safeName === "id" || safeName === "created_at" || safeName === "updated_at") {
      continue; // skip baseline columns if user tries to redefine them
    }

    const pgType = COLUMN_TYPE_MAP[col.type];
    if (!pgType) throw new Error(`Unsupported column type: "${col.type}"`);

    const nullable = col.nullable !== false ? "" : " NOT NULL";
    const defaultVal = col.defaultValue ? ` DEFAULT ${escapeLiteral(col.defaultValue)}` : "";
    colDefs.push(`"${safeName}" ${pgType}${nullable}${defaultVal}`);

    allColumns.push({
      name: safeName,
      type: col.type,
      nullable: col.nullable !== false,
      defaultValue: col.defaultValue,
    });
  }

  const sql = `CREATE TABLE IF NOT EXISTS "${safeSchema}"."${physName}" (\n  ${colDefs.join(",\n  ")}\n)`;
  await prisma.$executeRawUnsafe(sql);

  // Add updated_at trigger
  const triggerFn = `
    CREATE OR REPLACE FUNCTION "${safeSchema}"."trg_update_timestamp"()
    RETURNS trigger AS $$
    BEGIN NEW.updated_at = now(); RETURN NEW; END;
    $$ LANGUAGE plpgsql;
  `;
  await prisma.$executeRawUnsafe(triggerFn);

  const triggerSql = `
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_${physName}'
      ) THEN
        CREATE TRIGGER "set_updated_at_${physName}"
          BEFORE UPDATE ON "${safeSchema}"."${physName}"
          FOR EACH ROW EXECUTE FUNCTION "${safeSchema}"."trg_update_timestamp"();
      END IF;
    END $$;
  `;
  await prisma.$executeRawUnsafe(triggerSql);

  return { physicalName: physName, allColumns };
}

/**
 * Add columns to an existing table.
 */
export async function addColumns(
  schema: string,
  physicalName: string,
  columns: TableColumnDef[]
): Promise<void> {
  const safeSchema = sanitizeIdentifier(schema);
  if (!safeSchema) throw new Error(`Invalid schema: "${schema}"`);

  for (const col of columns) {
    const safeName = sanitizeColumnName(col.name);
    if (!safeName) throw new Error(`Invalid column name: "${col.name}"`);

    const pgType = COLUMN_TYPE_MAP[col.type];
    if (!pgType) throw new Error(`Unsupported column type: "${col.type}"`);

    const nullable = col.nullable !== false ? "" : " NOT NULL";
    const defaultVal = col.defaultValue ? ` DEFAULT ${escapeLiteral(col.defaultValue)}` : "";

    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${safeSchema}"."${physicalName}" ADD COLUMN IF NOT EXISTS "${safeName}" ${pgType}${nullable}${defaultVal}`
    );
  }
}

/**
 * List all tables in a schema matching a prefix.
 */
export async function listTablesInSchema(
  schema: string,
  prefix: string
): Promise<Array<{ tableName: string; rowCount: number }>> {
  const safeSchema = sanitizeIdentifier(schema);
  if (!safeSchema) throw new Error(`Invalid schema: "${schema}"`);

  const result = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name LIKE $2`,
    safeSchema,
    `${prefix}__%`
  );

  const tables: Array<{ tableName: string; rowCount: number }> = [];
  for (const row of result) {
    if (!tableMatchesPrefix(row.table_name, prefix)) continue;
    // Get approximate row count from pg_stat
    const countResult = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
      `SELECT COUNT(*) as cnt FROM "${safeSchema}"."${row.table_name}" LIMIT 1`,
    );
    tables.push({
      tableName: row.table_name,
      rowCount: Number(countResult[0]?.cnt ?? 0),
    });
  }

  return tables;
}

/**
 * Describe a table's columns from information_schema.
 */
export async function describeTable(
  schema: string,
  physicalName: string
): Promise<Array<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }>> {
  const safeSchema = sanitizeIdentifier(schema);
  if (!safeSchema) throw new Error(`Invalid schema: "${schema}"`);

  return prisma.$queryRawUnsafe(
    `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2
     ORDER BY ordinal_position`,
    safeSchema,
    physicalName
  );
}

/**
 * Drop all tables matching a prefix in a schema. Used during dashboard deletion.
 */
export async function dropTablesWithPrefix(schema: string, prefix: string): Promise<string[]> {
  const safeSchema = sanitizeIdentifier(schema);
  if (!safeSchema) throw new Error(`Invalid schema: "${schema}"`);

  const tables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name LIKE $2`,
    safeSchema,
    `${prefix}__%`
  );

  const dropped: string[] = [];
  for (const row of tables) {
    if (!tableMatchesPrefix(row.table_name, prefix)) continue;
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${safeSchema}"."${row.table_name}" CASCADE`);
    dropped.push(row.table_name);
  }

  return dropped;
}

// ─── Data Operations ─────────────────────────────────────────────────────────

/**
 * Read rows from a table with optional filtering and pagination.
 */
export async function readRows(
  schema: string,
  physicalName: string,
  options: {
    where?: Record<string, unknown>;
    orderBy?: string;
    orderDir?: "ASC" | "DESC";
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ rows: Record<string, unknown>[]; totalCount: number }> {
  const safeSchema = sanitizeIdentifier(schema);
  if (!safeSchema) throw new Error(`Invalid schema: "${schema}"`);

  const limit = Math.min(options.limit ?? 100, 1000);
  const offset = options.offset ?? 0;

  // Count
  const countResult = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
    `SELECT COUNT(*) as cnt FROM "${safeSchema}"."${physicalName}"`
  );
  const totalCount = Number(countResult[0]?.cnt ?? 0);

  // Order
  const orderCol = options.orderBy ? sanitizeColumnName(options.orderBy) : "created_at";
  const orderDir = options.orderDir === "ASC" ? "ASC" : "DESC";
  const orderClause = orderCol ? `ORDER BY "${orderCol}" ${orderDir}` : "";

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM "${safeSchema}"."${physicalName}" ${orderClause} LIMIT ${limit} OFFSET ${offset}`
  );

  return { rows, totalCount };
}

/**
 * Insert rows into a table.
 */
export async function insertRows(
  schema: string,
  physicalName: string,
  rows: Record<string, unknown>[]
): Promise<number> {
  if (rows.length === 0) return 0;

  const safeSchema = sanitizeIdentifier(schema);
  if (!safeSchema) throw new Error(`Invalid schema: "${schema}"`);

  // Get columns from first row
  const columns = Object.keys(rows[0])
    .map((c) => sanitizeColumnName(c))
    .filter(Boolean);

  if (columns.length === 0) throw new Error("No valid columns in data");

  let inserted = 0;
  // Batch insert in chunks of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const valuePlaceholders: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    for (const row of batch) {
      const placeholders: string[] = [];
      for (const col of columns) {
        placeholders.push(`$${paramIdx}`);
        params.push(row[col] ?? null);
        paramIdx++;
      }
      valuePlaceholders.push(`(${placeholders.join(", ")})`);
    }

    const colList = columns.map((c) => `"${c}"`).join(", ");
    const sql = `INSERT INTO "${safeSchema}"."${physicalName}" (${colList}) VALUES ${valuePlaceholders.join(", ")}`;
    await prisma.$executeRawUnsafe(sql, ...params);
    inserted += batch.length;
  }

  return inserted;
}

/**
 * Update rows in a table by ID.
 */
export async function updateRows(
  schema: string,
  physicalName: string,
  updates: Array<{ id: string; data: Record<string, unknown> }>
): Promise<number> {
  if (updates.length === 0) return 0;

  const safeSchema = sanitizeIdentifier(schema);
  if (!safeSchema) throw new Error(`Invalid schema: "${schema}"`);

  let updated = 0;
  for (const { id, data } of updates) {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    for (const [key, value] of Object.entries(data)) {
      const safeKey = sanitizeColumnName(key);
      if (!safeKey || safeKey === "id" || safeKey === "created_at") continue;
      setClauses.push(`"${safeKey}" = $${paramIdx}`);
      params.push(value ?? null);
      paramIdx++;
    }

    if (setClauses.length === 0) continue;

    params.push(id);
    const sql = `UPDATE "${safeSchema}"."${physicalName}" SET ${setClauses.join(", ")} WHERE "id" = $${paramIdx}`;
    const result = await prisma.$executeRawUnsafe(sql, ...params);
    updated += result;
  }

  return updated;
}

/**
 * Delete rows by ID.
 */
export async function deleteRows(
  schema: string,
  physicalName: string,
  ids: string[]
): Promise<number> {
  if (ids.length === 0) return 0;

  const safeSchema = sanitizeIdentifier(schema);
  if (!safeSchema) throw new Error(`Invalid schema: "${schema}"`);

  const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
  const sql = `DELETE FROM "${safeSchema}"."${physicalName}" WHERE "id" IN (${placeholders})`;
  return prisma.$executeRawUnsafe(sql, ...ids);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Escape a string literal for use in DEFAULT values.
 * Only used for default values, not for user data (which uses parameterized queries).
 */
function escapeLiteral(value: string): string {
  // For known safe defaults like 'now()', pass through
  if (/^[a-z_]+\(\)$/i.test(value)) return value;
  // Boolean/numeric literals
  if (/^(true|false|\d+(\.\d+)?)$/i.test(value)) return value;
  // String literal: escape single quotes
  return `'${value.replace(/'/g, "''")}'`;
}
