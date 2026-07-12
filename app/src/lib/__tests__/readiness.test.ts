import { beforeEach, describe, expect, it, vi } from "vitest";

const readinessMocks = vi.hoisted(() => ({
  pools: [] as Array<{
    options: Record<string, unknown>;
    query: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("pg", () => ({
  Pool: class {
    query = vi.fn().mockResolvedValue({ rows: [{ result: 1 }] });
    end = vi.fn().mockResolvedValue(undefined);
    on = vi.fn();

    constructor(options: Record<string, unknown>) {
      readinessMocks.pools.push({
        options,
        query: this.query,
        end: this.end,
        on: this.on,
      });
    }
  },
}));

import {
  checkPostgresReadiness,
  getReadinessTimeoutMs,
  probePostgres,
  type ReadinessPool,
} from "@/lib/readiness";

beforeEach(() => {
  readinessMocks.pools.length = 0;
  vi.unstubAllEnvs();
  delete (globalThis as typeof globalThis & { twdReadinessPool?: unknown }).twdReadinessPool;
});

describe("getReadinessTimeoutMs", () => {
  it("uses a bounded default for missing or invalid values", () => {
    expect(getReadinessTimeoutMs(undefined)).toBe(2_000);
    expect(getReadinessTimeoutMs("not-a-number")).toBe(2_000);
    expect(getReadinessTimeoutMs("99")).toBe(2_000);
    expect(getReadinessTimeoutMs("10001")).toBe(2_000);
  });

  it("accepts an integer from 100 through 10000 milliseconds", () => {
    expect(getReadinessTimeoutMs("100")).toBe(100);
    expect(getReadinessTimeoutMs("2500")).toBe(2_500);
    expect(getReadinessTimeoutMs("10000")).toBe(10_000);
  });
});

describe("probePostgres", () => {
  it("reports ready after a successful SELECT 1", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ result: 1 }] });

    await expect(probePostgres({ query } as ReadinessPool, 100)).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith("SELECT 1");
  });

  it("sanitizes database failures into a false readiness result", async () => {
    const query = vi.fn().mockRejectedValue(
      new Error("password=do-not-leak host=private.internal")
    );

    await expect(probePostgres({ query } as ReadinessPool, 100)).resolves.toBe(false);
  });

  it("returns within the configured timeout when the driver does not settle", async () => {
    const query = vi.fn(() => new Promise(() => undefined));
    const startedAt = Date.now();

    await expect(probePostgres({ query } as ReadinessPool, 25)).resolves.toBe(false);
    expect(Date.now() - startedAt).toBeLessThan(200);
  });
});

describe("checkPostgresReadiness", () => {
  it("falha fechado sem DATABASE_URL", async () => {
    vi.stubEnv("DATABASE_URL", "");

    await expect(checkPostgresReadiness()).resolves.toBe(false);
    expect(readinessMocks.pools).toHaveLength(0);
  });

  it("cria pool limitado e reutiliza a mesma configuração", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://db-a/app");
    vi.stubEnv("TWD_READINESS_TIMEOUT_MS", "250");

    await expect(checkPostgresReadiness()).resolves.toBe(true);
    await expect(checkPostgresReadiness()).resolves.toBe(true);

    expect(readinessMocks.pools).toHaveLength(1);
    expect(readinessMocks.pools[0].options).toMatchObject({
      application_name: "talk-with-data-readiness",
      connectionString: "postgresql://db-a/app",
      connectionTimeoutMillis: 250,
      max: 1,
      query_timeout: 250,
      statement_timeout: 250,
    });
    expect(readinessMocks.pools[0].on).toHaveBeenCalledWith("error", expect.any(Function));
    expect(readinessMocks.pools[0].query).toHaveBeenCalledTimes(2);
  });

  it("substitui e encerra pool quando conexão ou timeout muda", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://db-a/app");
    vi.stubEnv("TWD_READINESS_TIMEOUT_MS", "250");
    await expect(checkPostgresReadiness()).resolves.toBe(true);
    const firstPool = readinessMocks.pools[0];

    vi.stubEnv("DATABASE_URL", "postgresql://db-b/app");
    vi.stubEnv("TWD_READINESS_TIMEOUT_MS", "500");
    await expect(checkPostgresReadiness()).resolves.toBe(true);

    expect(readinessMocks.pools).toHaveLength(2);
    expect(firstPool.end).toHaveBeenCalledOnce();
    expect(readinessMocks.pools[1].options).toMatchObject({
      connectionString: "postgresql://db-b/app",
      connectionTimeoutMillis: 500,
    });
  });
});
