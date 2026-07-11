import { describe, expect, it, vi } from "vitest";
import {
  getReadinessTimeoutMs,
  probePostgres,
  type ReadinessPool,
} from "@/lib/readiness";

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
