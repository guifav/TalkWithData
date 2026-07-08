import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import {
  parseCsvTable,
  type CsvColumn,
  type InferredColumnType,
} from "@/lib/data-sources/csv-table";
import { DuckDbSandboxError } from "@/lib/data-sources/duckdb-sandbox";
import { DataSourceUnavailableError } from "@/lib/data-sources/errors";
import { guardSql } from "@/lib/data-sources/sql-guard";
import type { DataSource } from "@/lib/data-sources/types";
import type {
  DuckDBConnection,
  DuckDBInstance,
  DuckDBResultReader,
} from "@duckdb/node-api";

export interface LoadSourceArgs {
  source: DataSource;
  csvBuffer: Buffer;
  viewerScope: { ownerKeys: string[] };
  etag: string;
  configVersion: number;
}

export interface DuckDbSource {
  viewName: string;
  run(sql: string): Promise<{ columns: string[]; rows: unknown[][]; truncated: boolean }>;
}

interface DuckDbApiModule {
  DuckDBInstance?: typeof DuckDBInstance;
}

interface CachedRawSource {
  instance: DuckDBInstance;
  rawSafe: string;
  columns: CsvColumn[];
  bytes: number;
  activeUses: number;
}

const requireModule = createRequire(import.meta.url);
const DEFAULT_QUERY_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_ROWS = 1_000;
const DEFAULT_ENGINE_LRU_BYTES = 64 * 1024 * 1024;
const SAFE_IDENTIFIER_PATTERN = /^[a-z0-9_]+$/;
const INT4_MIN = -2147483648;
const INT4_MAX = 2147483647;
const rawSourceCache = new Map<string, CachedRawSource>();
const rawSourcePromiseCache = new Map<string, Promise<CachedRawSource>>();
let cachedBytes = 0;

export async function loadSource(args: LoadSourceArgs): Promise<DuckDbSource> {
  const viewName = filteredViewName(args.source.id);
  return {
    viewName,
    async run(sql: string): Promise<{ columns: string[]; rows: unknown[][]; truncated: boolean }> {
      const guardResult = guardSql(sql, { allowedViewName: viewName });
      if (!guardResult.ok) {
        throw new DuckDbSandboxError(guardResult.reason);
      }

      const rawSource = await getOrCreateRawSource(args);
      rawSource.activeUses += 1;
      let connection: DuckDBConnection | undefined;
      try {
        connection = await rawSource.instance.connect();
        await createFilteredView(
          connection,
          args.source,
          rawSource.rawSafe,
          rawSource.columns,
          args.viewerScope.ownerKeys,
        );
        return await runWithTimeout(
          connection,
          sql,
          resolveQueryTimeoutMs(),
          resolveMaxRows(),
        );
      } finally {
        rawSource.activeUses -= 1;
        if (connection) connection.closeSync();
      }
    },
  };
}

async function getOrCreateRawSource(args: LoadSourceArgs): Promise<CachedRawSource> {
  const cacheKey = rawSourceCacheKey(args);
  const cached = rawSourceCache.get(cacheKey);
  if (cached) {
    rawSourceCache.delete(cacheKey);
    rawSourceCache.set(cacheKey, cached);
    return cached;
  }

  const inFlight = rawSourcePromiseCache.get(cacheKey);
  if (inFlight) return inFlight;

  const promise = createRawSource(args).finally(() => {
    rawSourcePromiseCache.delete(cacheKey);
  });
  rawSourcePromiseCache.set(cacheKey, promise);
  return promise;
}

async function createRawSource(args: LoadSourceArgs): Promise<CachedRawSource> {
  const instance = await createDuckDbInstance();
  let connection: DuckDBConnection | undefined;

  try {
    connection = await instance.connect();
    const parsed = parseCsvTable(args.csvBuffer);
    const resolvedColumns = resolveColumnTypes(
      parsed.columns,
      parsed.rows,
      args.source.ownerColumn,
    );
    const rawSafe = rawTableName(args.source.id);
    validateIdentifier(rawSafe);
    resolvedColumns.forEach((column) => validateIdentifier(column.safeName));

    await connection.runAndReadAll(
      `CREATE TABLE ${quoteIdentifier(rawSafe)} (${resolvedColumns
        .map((column) => `${quoteIdentifier(column.safeName)} ${duckType(column.type)}`)
        .join(", ")})`,
    );
    await insertRows(connection, rawSafe, resolvedColumns, parsed.rows);
    connection.closeSync();

    const rawSource: CachedRawSource = {
      instance,
      rawSafe,
      columns: resolvedColumns,
      bytes: args.csvBuffer.byteLength,
      activeUses: 0,
    };
    const cacheKey = rawSourceCacheKey(args);
    rawSourceCache.set(cacheKey, rawSource);
    cachedBytes += rawSource.bytes;
    enforceCacheLimit(cacheKey);
    return rawSource;
  } catch (error) {
    connection?.closeSync();
    instance.closeSync();
    if (error instanceof DuckDbSandboxError) throw error;
    throw new DuckDbSandboxError(errorMessage(error), error);
  }
}

function resolveColumnTypes(
  columns: CsvColumn[],
  rows: string[][],
  ownerColumn?: string,
): CsvColumn[] {
  return columns.map((column, index) => {
    if (column.rawName === ownerColumn) {
      return { ...column, type: "text" };
    }
    if (column.type === "date" || column.type === "timestamp") {
      return { ...column, type: "text" };
    }
    if (column.type === "integer") {
      const allInt4 = rows.every((row) => {
        const value = row[index];
        if (value === undefined || value === null || value.trim() === "") return true;
        const numeric = Number(value);
        return (
          Number.isFinite(numeric) &&
          Number.isInteger(numeric) &&
          numeric >= INT4_MIN &&
          numeric <= INT4_MAX
        );
      });
      if (allInt4) return column;
      const allNumeric = rows.every((row) => {
        const value = row[index];
        return (
          value === undefined ||
          value === null ||
          value.trim() === "" ||
          Number.isFinite(Number(value))
        );
      });
      return { ...column, type: allNumeric ? "decimal" : "text" };
    }
    if (column.type === "decimal") {
      const allNumeric = rows.every((row) => {
        const value = row[index];
        return (
          value === undefined ||
          value === null ||
          value.trim() === "" ||
          Number.isFinite(Number(value))
        );
      });
      return allNumeric ? column : { ...column, type: "text" };
    }
    if (column.type === "boolean") {
      const allBoolean = rows.every((row) => {
        const value = row[index];
        const lower = (value ?? "").toLowerCase();
        return (
          value === undefined ||
          value === null ||
          value.trim() === "" ||
          lower === "true" ||
          lower === "false" ||
          lower === "1" ||
          lower === "0"
        );
      });
      return allBoolean ? column : { ...column, type: "text" };
    }
    return column;
  });
}

async function createFilteredView(
  connection: DuckDBConnection,
  source: DataSource,
  rawSafe: string,
  columns: CsvColumn[],
  ownerKeys: string[],
): Promise<string> {
  const viewName = filteredViewName(source.id);
  validateIdentifier(viewName);
  validateIdentifier(rawSafe);

  const ownerColumn = source.ownerColumn
    ? columns.find((column) => column.rawName === source.ownerColumn)
    : undefined;
  const ownerColSafe = ownerColumn?.safeName;

  // Falha fechado se a coluna de escopo estiver ausente, vazia ou nao casar
  // exatamente com uma coluna do CSV. Sem ownerColumn valido, a view cairia em
  // SELECT * e exporia o schema bruto (incluindo a coluna de owner) no
  // resultado, violando o contrato de nao vazar ownerColumn/emails de owner.
  if (!ownerColSafe) {
    const detail = source.ownerColumn
      ? `declara ownerColumn "${source.ownerColumn}" ausente no CSV`
      : "nao declara ownerColumn valida";
    throw new DataSourceUnavailableError(`DataSource ${source.id} ${detail}`);
  }
  validateIdentifier(ownerColSafe);

  await connection.runAndReadAll("CREATE TEMP TABLE auth_keys(k VARCHAR)");
  if (ownerColSafe) {
    const statement = await connection.prepare("INSERT INTO auth_keys VALUES (?)");
    try {
      for (const key of ownerKeys) {
        statement.bindVarchar(1, key);
        await statement.run();
        statement.clearBindings();
      }
    } finally {
      statement.destroySync();
    }
  }

  const filterSql = ownerColSafe
    ? `${quoteIdentifier(ownerColSafe)} IN (SELECT k FROM auth_keys)`
    : "1 = 0";

  // A coluna de escopo (ownerColumn) NUNCA e exposta pela view filtrada.
  // CSVs podem ter headers duplicados (ex.: "owner,owner,amount"); o
  // csv-table gera safeNames "owner", "owner_2", ... mas o rawName continua
  // "owner". Filtramos por rawName para excluir TODAS as colunas de escopo,
  // nao so a primeira, fechando o vazamento via coluna duplicada.
  const ownerRaw = source.ownerColumn;
  const ownerColumns = columns.filter((column) => column.rawName === ownerRaw);
  if (ownerColumns.length > 1) {
    // CSV malformado: mais de uma coluna de escopo com o mesmo nome. Falha
    // fechado em vez de expor a duplicata na view.
    throw new DataSourceUnavailableError(
      `DataSource ${source.id} possui multiplas colunas de escopo "${ownerRaw}"`,
    );
  }
  const projectedColumns = ownerColSafe
    ? columns
        .filter((column) => column.rawName !== ownerRaw)
        .map((column) => quoteIdentifier(column.safeName))
        .join(", ")
    : "*";

  // Falha fechado se nao houver nenhuma coluna de dados alem da ownerColumn:
  // nunca podemos cair em SELECT * (que reexporia a coluna de escopo).
  if (ownerColSafe && projectedColumns.length === 0) {
    throw new DataSourceUnavailableError(
      `DataSource ${source.id} nao possui colunas de dados alem da coluna de escopo`,
    );
  }
  const selectList = projectedColumns.length > 0 ? projectedColumns : "*";

  await connection.runAndReadAll(
    `CREATE OR REPLACE TEMP VIEW ${quoteIdentifier(viewName)} AS SELECT ${selectList} FROM ${quoteIdentifier(rawSafe)} WHERE ${filterSql}`,
  );

  return viewName;
}

async function createDuckDbInstance(): Promise<DuckDBInstance> {
  const duckDb = loadDuckDbApi();
  if (!duckDb?.DuckDBInstance) {
    throw new DuckDbSandboxError("pacote @duckdb/node-api não instalado");
  }

  return duckDb.DuckDBInstance.create(":memory:", {
    autoinstall_known_extensions: "false",
    autoload_known_extensions: "false",
    enable_external_access: "false",
    lock_configuration: "true",
  });
}

async function insertRows(
  connection: DuckDBConnection,
  rawSafe: string,
  columns: CsvColumn[],
  rows: string[][],
): Promise<void> {
  const statement = await connection.prepare(
    `INSERT INTO ${quoteIdentifier(rawSafe)} VALUES (${columns.map(() => "?").join(", ")})`,
  );

  try {
    for (const row of rows) {
      columns.forEach((column, index) => {
        const value = row[index];
        const parameterIndex = index + 1;
        if (value === undefined || value === null || value.trim() === "") {
          statement.bindNull(parameterIndex);
          return;
        }
        if (column.type === "integer") {
          const numeric = Number(value);
          if (
            Number.isFinite(numeric) &&
            Number.isInteger(numeric) &&
            numeric >= INT4_MIN &&
            numeric <= INT4_MAX
          ) {
            statement.bindInteger(parameterIndex, numeric);
          } else {
            statement.bindNull(parameterIndex);
          }
          return;
        }
        if (column.type === "decimal") {
          const numeric = Number(value);
          if (Number.isFinite(numeric)) {
            statement.bindDouble(parameterIndex, numeric);
          } else {
            statement.bindNull(parameterIndex);
          }
          return;
        }
        if (column.type === "boolean") {
          const lower = value.toLowerCase();
          if (lower === "true" || lower === "1") {
            statement.bindBoolean(parameterIndex, true);
          } else if (lower === "false" || lower === "0") {
            statement.bindBoolean(parameterIndex, false);
          } else {
            statement.bindNull(parameterIndex);
          }
          return;
        }
        statement.bindVarchar(parameterIndex, value);
      });
      await statement.run();
      statement.clearBindings();
    }
  } finally {
    statement.destroySync();
  }
}

async function runWithTimeout(
  connection: DuckDBConnection,
  sql: string,
  queryTimeoutMs: number,
  maxRows: number,
): Promise<{ columns: string[]; rows: unknown[][]; truncated: boolean }> {
  let timedOut = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const limited = applyRowLimit(sql, maxRows);
  const queryPromise = connection.runAndReadAll(limited.sql);
  const guardedQueryPromise = queryPromise.catch((error: unknown) => {
    if (timedOut) return undefined as unknown as DuckDBResultReader;
    throw error;
  });
  const timeoutPromise = new Promise<DuckDBResultReader>((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      connection.interrupt();
      reject(new DuckDbSandboxError("timeout"));
    }, queryTimeoutMs);
  });

  try {
    const reader = await Promise.race([guardedQueryPromise, timeoutPromise]);
    if (!reader) throw new DuckDbSandboxError("timeout");
    return resultFromReader(reader, maxRows);
  } catch (error) {
    if (error instanceof DuckDbSandboxError) throw error;
    throw new DuckDbSandboxError(errorMessage(error), error);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function applyRowLimit(
  sql: string,
  maxRows: number,
): { sql: string } {
  const normalized = sql.trim().replace(/;\s*$/, "");
  return {
    sql: `SELECT * FROM (${normalized}) AS _twd_limit LIMIT ${maxRows + 1}`,
  };
}

function resultFromReader(
  reader: DuckDBResultReader,
  maxRows: number,
): { columns: string[]; rows: unknown[][]; truncated: boolean } {
  const columns = reader.columnNames();
  const rowObjects = reader.getRowObjectsJson();

  const truncated = rowObjects.length > maxRows;
  const rows = rowObjects
    .slice(0, maxRows)
    .map((row) => columns.map((column) => row[column] ?? null));
  return { columns, rows, truncated };
}

function duckType(type: InferredColumnType): string {
  if (type === "integer") return "INTEGER";
  if (type === "decimal") return "DOUBLE";
  if (type === "boolean") return "BOOLEAN";
  if (type === "date") return "DATE";
  if (type === "timestamp") return "TIMESTAMP";
  return "VARCHAR";
}

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function loadDuckDbApi(): DuckDbApiModule | null {
  try {
    return requireModule("@duckdb/node-api") as DuckDbApiModule;
  } catch {
    return null;
  }
}

function rawSourceCacheKey(args: LoadSourceArgs): string {
  return `${args.source.id}:${args.etag}:${args.configVersion}`;
}

function rawTableName(sourceId: string): string {
  return `twd_raw_${sourceIdHash(sourceId)}`;
}

function filteredViewName(sourceId: string): string {
  return `twd_${sourceIdHash(sourceId)}_filtered`;
}

function sourceIdHash(sourceId: string): string {
  return createHash("sha1").update(sourceId).digest("hex").slice(0, 16);
}

function validateIdentifier(identifier: string): void {
  if (!SAFE_IDENTIFIER_PATTERN.test(identifier)) {
    throw new DuckDbSandboxError("identificador DuckDB inválido");
  }
}

function enforceCacheLimit(protectedKey: string): void {
  const limit = resolveEngineLruBytes();
  if (cachedBytes <= limit) return;

  for (const [key, rawSource] of rawSourceCache) {
    if (cachedBytes <= limit) return;
    if (key === protectedKey) continue;
    if (rawSource.activeUses > 0) continue;

    rawSourceCache.delete(key);
    cachedBytes -= rawSource.bytes;
    rawSource.instance.closeSync();
  }
}

function resolveQueryTimeoutMs(): number {
  const envValue = Number(process.env.TWD_QUERY_TIMEOUT_MS);
  if (Number.isFinite(envValue) && envValue > 0) return envValue;
  return DEFAULT_QUERY_TIMEOUT_MS;
}

function resolveMaxRows(): number {
  const envValue = Number(process.env.TWD_MAX_ROWS);
  if (Number.isFinite(envValue) && envValue > 0) return Math.floor(envValue);
  return DEFAULT_MAX_ROWS;
}

function resolveEngineLruBytes(): number {
  const envValue = Number(process.env.TWD_ENGINE_LRU_BYTES);
  if (Number.isFinite(envValue) && envValue > 0) return Math.floor(envValue);
  return DEFAULT_ENGINE_LRU_BYTES;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function __engineCacheReset(): void {
  for (const rawSource of rawSourceCache.values()) {
    rawSource.instance.closeSync();
  }
  rawSourceCache.clear();
  cachedBytes = 0;
}

export function __engineCacheStats(): { size: number; bytes: number } {
  return { size: rawSourceCache.size, bytes: cachedBytes };
}
