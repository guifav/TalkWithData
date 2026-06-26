/**
 * Naming conventions for app-database isolation.
 *
 * Schema per user:  usr_<sha256(uid)[0:8]>
 * Table prefix:     d_<dashboardId[0:12]>
 * Physical table:   <schema>.<prefix>__<logical_name>
 *
 * All names are lowercased and sanitized to [a-z0-9_].
 */

import { createHash } from "crypto";

const SCHEMA_PREFIX = "usr_";
const TABLE_PREFIX = "d_";
const TABLE_SEPARATOR = "__";

/**
 * Maximum length for logical table names (the user-facing part).
 *
 * Budget: "d_" (2) + dashboardId[0:12] (12) + "__" (2) + logical = physical name
 * PostgreSQL limit: 63 bytes for identifiers.
 * Trigger name: "set_updated_at_" (15) + physical name.
 * To stay under 63: 15 + 2 + 12 + 2 + logical <= 63 → logical <= 32.
 */
export const MAX_LOGICAL_NAME_LENGTH = 32;

/**
 * Derive the Postgres schema name for a Firebase UID.
 * Deterministic: same UID always produces the same schema.
 */
export function userSchemaName(uid: string): string {
  const hash = createHash("sha256").update(uid).digest("hex").slice(0, 8);
  return `${SCHEMA_PREFIX}${hash}`;
}

/**
 * Derive the table prefix for a dashboard ID.
 * Uses first 12 chars of the Firestore doc ID (already random).
 */
export function dashboardTablePrefix(dashboardId: string): string {
  const safe = dashboardId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 12);
  return `${TABLE_PREFIX}${safe}`;
}

/**
 * Build the physical table name from prefix + logical name.
 */
export function physicalTableName(prefix: string, logicalName: string): string {
  const safe = sanitizeIdentifier(logicalName);
  if (!safe) throw new Error(`Invalid logical name: "${logicalName}"`);
  return `${prefix}${TABLE_SEPARATOR}${safe}`;
}

/**
 * Validate that a string is a safe SQL identifier component.
 * Only allows lowercase letters, digits, and underscores.
 * Must start with a letter.
 */
export function sanitizeIdentifier(name: string): string {
  const lower = name.toLowerCase().trim();
  // Replace spaces/hyphens with underscores
  const normalized = lower.replace(/[\s-]+/g, "_");
  // Strip anything that isn't [a-z0-9_]
  const safe = normalized.replace(/[^a-z0-9_]/g, "");
  // Must start with a letter
  if (!safe || !/^[a-z]/.test(safe)) return "";
  return safe.slice(0, MAX_LOGICAL_NAME_LENGTH);
}

/**
 * Validate that a column name is safe.
 */
export function sanitizeColumnName(name: string): string {
  return sanitizeIdentifier(name);
}

/**
 * Check if a physical table name belongs to the given prefix.
 */
export function tableMatchesPrefix(tableName: string, prefix: string): boolean {
  return tableName.startsWith(`${prefix}${TABLE_SEPARATOR}`);
}

/**
 * Supported column types and their Postgres equivalents.
 */
export const COLUMN_TYPE_MAP: Record<string, string> = {
  text: "TEXT",
  integer: "INTEGER",
  bigint: "BIGINT",
  decimal: "NUMERIC(18,4)",
  boolean: "BOOLEAN",
  date: "DATE",
  timestamp: "TIMESTAMPTZ",
  json: "JSONB",
  uuid: "UUID",
};

export const SUPPORTED_COLUMN_TYPES = Object.keys(COLUMN_TYPE_MAP);
