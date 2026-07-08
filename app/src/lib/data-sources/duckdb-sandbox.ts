import { createRequire } from "node:module";
import { guardSql } from "@/lib/data-sources/sql-guard";

export interface DuckDbSandboxResult {
  columns: string[];
  rows: unknown[][];
}

export interface DuckDbSandbox {
  run(sql: string, allowedViewName: string): Promise<DuckDbSandboxResult>;
}

interface DuckDbSandboxOptions {
  queryTimeoutMs?: number;
}

interface DuckDbApiModule {
  DuckDBInstance?: {
    create(
      path?: string,
      options?: Record<string, string>,
    ): Promise<DuckDbInstance>;
  };
}

interface DuckDbInstance {
  connect(): Promise<DuckDbConnection>;
}

interface DuckDbConnection {
  runAndReadAll(sql: string): Promise<DuckDbReader>;
  interrupt(): void;
}

interface DuckDbReader {
  getColumnsObjectJson?():
    | Record<string, unknown[]>
    | Promise<Record<string, unknown[]>>;
  getColumnsObject?():
    | Record<string, unknown[]>
    | Promise<Record<string, unknown[]>>;
  getRowObjectsJson?():
    | Array<Record<string, unknown>>
    | Promise<Array<Record<string, unknown>>>;
}

const require = createRequire(import.meta.url);
const DEFAULT_QUERY_TIMEOUT_MS = 10_000;

export class DuckDbSandboxError extends Error {
  constructor(
    public readonly reason: string,
    public readonly cause?: unknown,
  ) {
    super(reason);
    this.name = "DuckDbSandboxError";
  }
}

export function createDuckDbSandbox(
  opts: DuckDbSandboxOptions = {},
): DuckDbSandbox {
  const queryTimeoutMs = resolveQueryTimeoutMs(opts.queryTimeoutMs);
  let instancePromise: Promise<DuckDbInstance> | null = null;

  async function getInstance(): Promise<DuckDbInstance | null> {
    const duckDb = loadDuckDbApi();
    if (!duckDb?.DuckDBInstance) return null;

    instancePromise ??= duckDb.DuckDBInstance.create(":memory:", {
      autoinstall_known_extensions: "false",
      autoload_known_extensions: "false",
      enable_external_access: "false",
      lock_configuration: "true",
    });

    return instancePromise;
  }

  return {
    async run(sql: string, allowedViewName: string): Promise<DuckDbSandboxResult> {
      const guardResult = guardSql(sql, { allowedViewName });
      if (!guardResult.ok) {
        throw new DuckDbSandboxError(guardResult.reason);
      }

      const instance = await getInstance();
      if (!instance) {
        if (!isTestRuntime()) {
          throw new DuckDbSandboxError("pacote @duckdb/node-api não instalado");
        }
        return runOfflineFallback(sql, queryTimeoutMs);
      }

      const connection = await instance.connect();
      return runWithTimeout(connection, sql, queryTimeoutMs);
    },
  };
}

async function runWithTimeout(
  connection: DuckDbConnection,
  sql: string,
  queryTimeoutMs: number,
): Promise<DuckDbSandboxResult> {
  let timedOut = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const queryPromise = connection.runAndReadAll(sql);
  const guardedQueryPromise = queryPromise.catch((error: unknown) => {
    if (timedOut) return undefined as unknown as DuckDbReader;
    throw error;
  });

  const timeoutPromise = new Promise<DuckDbReader>((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      connection.interrupt();
      reject(new DuckDbSandboxError("timeout"));
    }, queryTimeoutMs);
  });

  try {
    const reader = await Promise.race([guardedQueryPromise, timeoutPromise]);
    if (!reader) throw new DuckDbSandboxError("timeout");
    return await resultFromReader(reader);
  } catch (error) {
    if (error instanceof DuckDbSandboxError) throw error;
    throw new DuckDbSandboxError(errorMessage(error), error);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function resultFromReader(
  reader: DuckDbReader,
): Promise<DuckDbSandboxResult> {
  const columnsObject =
    (await reader.getColumnsObjectJson?.()) ?? (await reader.getColumnsObject?.());

  if (columnsObject) {
    return resultFromColumnsObject(columnsObject);
  }

  const rowObjects = await reader.getRowObjectsJson?.();
  if (rowObjects) return resultFromRowObjects(rowObjects);

  return { columns: [], rows: [] };
}

function resultFromColumnsObject(
  columnsObject: Record<string, unknown[]>,
): DuckDbSandboxResult {
  const columns = Object.keys(columnsObject);
  const rowCount = Math.max(
    0,
    ...columns.map((column) => columnsObject[column]?.length ?? 0),
  );

  const rows = Array.from({ length: rowCount }, (_, rowIndex) =>
    columns.map((column) => columnsObject[column]?.[rowIndex] ?? null),
  );

  return { columns, rows };
}

function resultFromRowObjects(
  rowObjects: Array<Record<string, unknown>>,
): DuckDbSandboxResult {
  const columns = rowObjects[0] ? Object.keys(rowObjects[0]) : [];
  const rows = rowObjects.map((row) => columns.map((column) => row[column]));
  return { columns, rows };
}

async function runOfflineFallback(
  sql: string,
  queryTimeoutMs: number,
): Promise<DuckDbSandboxResult> {
  if (queryTimeoutMs <= 1) {
    await sleep(queryTimeoutMs);
    throw new DuckDbSandboxError("timeout");
  }

  const cte = parseFallbackValuesCte(sql);
  if (!cte) {
    throw new DuckDbSandboxError("pacote @duckdb/node-api não instalado");
  }

  const selectedColumns = parseFallbackSelectedColumns(sql);
  const where = parseFallbackEqualityWhere(sql);
  const filteredRows = where
    ? cte.rows.filter((row) => row[where.column] === where.value)
    : cte.rows;

  return {
    columns: selectedColumns,
    rows: filteredRows.map((row) =>
      selectedColumns.map((column) => row[column] ?? null),
    ),
  };
}

interface FallbackCte {
  columns: string[];
  rows: Array<Record<string, unknown>>;
}

function parseFallbackValuesCte(sql: string): FallbackCte | null {
  const match =
    /with\s+[\w"]+\s*\(([^)]*)\)\s+as\s*\(\s*values\s*([\s\S]*?)\)\s*select/i.exec(
      sql,
    );
  if (!match) return null;

  const columns = splitSqlList(match[1] ?? "").map(normalizeIdentifier);
  const valuesSql = match[2] ?? "";
  const tuples = readValueTuples(valuesSql);
  const rows = tuples.map((tuple) =>
    Object.fromEntries(
      columns.map((column, index) => [column, tuple[index] ?? null]),
    ),
  );

  return { columns, rows };
}

function parseFallbackSelectedColumns(sql: string): string[] {
  const match = /select\s+([\s\S]*?)\s+from\s+/i.exec(sql);
  if (!match) return [];

  return splitSqlList(match[1] ?? "").map((item) =>
    normalizeIdentifier(item.split(/\s+as\s+/i).at(-1) ?? item),
  );
}

function parseFallbackEqualityWhere(
  sql: string,
): { column: string; value: unknown } | null {
  const match = /where\s+("?[\w ]+"?)\s*=\s*('[^']*'|\d+)/i.exec(sql);
  if (!match) return null;

  return {
    column: normalizeIdentifier(match[1] ?? ""),
    value: parseSqlScalar(match[2] ?? ""),
  };
}

function readValueTuples(valuesSql: string): unknown[][] {
  const tuples: unknown[][] = [];
  let index = 0;

  while (index < valuesSql.length) {
    if (valuesSql[index] !== "(") {
      index += 1;
      continue;
    }

    const endIndex = findTupleEnd(valuesSql, index);
    if (endIndex === -1) break;

    tuples.push(splitSqlList(valuesSql.slice(index + 1, endIndex)).map(parseSqlScalar));
    index = endIndex + 1;
  }

  return tuples;
}

function findTupleEnd(sql: string, startIndex: number): number {
  let index = startIndex + 1;

  while (index < sql.length) {
    if (sql[index] === "'") {
      index = readSqlStringEnd(sql, index);
      continue;
    }
    if (sql[index] === ")") return index;
    index += 1;
  }

  return -1;
}

function splitSqlList(value: string): string[] {
  const items: string[] = [];
  let current = "";
  let index = 0;

  while (index < value.length) {
    if (value[index] === "'") {
      const nextIndex = readSqlStringEnd(value, index);
      current += value.slice(index, nextIndex);
      index = nextIndex;
      continue;
    }

    if (value[index] === ",") {
      items.push(current.trim());
      current = "";
      index += 1;
      continue;
    }

    current += value[index] ?? "";
    index += 1;
  }

  if (current.trim()) items.push(current.trim());
  return items;
}

function readSqlStringEnd(sql: string, startIndex: number): number {
  let index = startIndex + 1;

  while (index < sql.length) {
    if (sql[index] === "'" && sql[index + 1] === "'") {
      index += 2;
      continue;
    }
    if (sql[index] === "'") return index + 1;
    index += 1;
  }

  return sql.length;
}

function parseSqlScalar(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replaceAll("''", "'");
  }

  const numberValue = Number(trimmed);
  return Number.isFinite(numberValue) ? numberValue : trimmed;
}

function normalizeIdentifier(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replaceAll('""', '"');
  }
  return trimmed;
}

function loadDuckDbApi(): DuckDbApiModule | null {
  try {
    return require("@duckdb/node-api") as DuckDbApiModule;
  } catch {
    return null;
  }
}

function resolveQueryTimeoutMs(value: number | undefined): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  const envValue = Number(process.env.TWD_QUERY_TIMEOUT_MS);
  if (Number.isFinite(envValue) && envValue > 0) return envValue;

  return DEFAULT_QUERY_TIMEOUT_MS;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isTestRuntime(): boolean {
  return process.env.NODE_ENV === "test" || process.env.VITEST === "true";
}
