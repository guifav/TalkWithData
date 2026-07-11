import { Pool } from "pg";

const DEFAULT_TIMEOUT_MS = 2_000;
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 10_000;

export type ReadinessPool = Pick<Pool, "query">;

type ReadinessPoolState = {
  connectionString: string;
  pool: Pool;
  timeoutMs: number;
};

const globalForReadiness = globalThis as typeof globalThis & {
  twdReadinessPool?: ReadinessPoolState;
};

export function getReadinessTimeoutMs(
  value = process.env.TWD_READINESS_TIMEOUT_MS
): number {
  const parsed = Number(value);
  if (
    !Number.isInteger(parsed) ||
    parsed < MIN_TIMEOUT_MS ||
    parsed > MAX_TIMEOUT_MS
  ) {
    return DEFAULT_TIMEOUT_MS;
  }
  return parsed;
}

export async function probePostgres(
  pool: ReadinessPool,
  timeoutMs: number
): Promise<boolean> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      pool.query("SELECT 1"),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("readiness timeout")), timeoutMs);
      }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function getReadinessPool(connectionString: string, timeoutMs: number): Pool {
  const current = globalForReadiness.twdReadinessPool;
  if (
    current?.connectionString === connectionString &&
    current.timeoutMs === timeoutMs
  ) {
    return current.pool;
  }

  if (current) void current.pool.end().catch(() => undefined);

  const pool = new Pool({
    application_name: "talk-with-data-readiness",
    connectionString,
    connectionTimeoutMillis: timeoutMs,
    idleTimeoutMillis: 10_000,
    max: 1,
    query_timeout: timeoutMs,
    statement_timeout: timeoutMs,
  });
  pool.on("error", () => undefined);

  globalForReadiness.twdReadinessPool = { connectionString, pool, timeoutMs };
  return pool;
}

export async function checkPostgresReadiness(): Promise<boolean> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return false;

  const timeoutMs = getReadinessTimeoutMs();
  return probePostgres(getReadinessPool(connectionString, timeoutMs), timeoutMs);
}
