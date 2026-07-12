import { afterEach, describe, expect, it, vi } from "vitest";

async function loadDashSession() {
  vi.resetModules();
  return import("@/lib/dash-session");
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("dash session secret resolution", () => {
  it("throws at first use in production when DASHBOARD_SESSION_SECRET is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DASHBOARD_SESSION_SECRET", undefined);
    const { createDashSessionToken } = await loadDashSession();
    expect(() => createDashSessionToken("dash1")).toThrow(/DASHBOARD_SESSION_SECRET/);
  });

  it("does not throw at import time in production (next build safety)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DASHBOARD_SESSION_SECRET", undefined);
    await expect(loadDashSession()).resolves.toBeDefined();
  });

  it("uses the configured secret in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DASHBOARD_SESSION_SECRET", "prod-secret");
    const { createDashSessionToken, verifyDashSessionToken } = await loadDashSession();
    const token = createDashSessionToken("dash1", "read");
    expect(verifyDashSessionToken("dash1", token, "read")).toBe(true);
  });

  it("falls back to a stable per-process secret outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DASHBOARD_SESSION_SECRET", undefined);
    const { createDashSessionToken, verifyDashSessionToken } = await loadDashSession();
    const a = createDashSessionToken("dash1");
    expect(verifyDashSessionToken("dash1", a)).toBe(true);
    expect(verifyDashSessionToken("dash1", createDashSessionToken("dash1"))).toBe(true);
  });

  it("rejects tokens presented for a different scope", async () => {
    vi.stubEnv("DASHBOARD_SESSION_SECRET", "s3cret");
    const { createDashSessionToken, verifyDashSessionToken } = await loadDashSession();
    const readToken = createDashSessionToken("dash1", "read");
    expect(verifyDashSessionToken("dash1", readToken, "write")).toBe(false);
  });

  it("rejects an expired token", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    vi.stubEnv("DASHBOARD_SESSION_SECRET", "s3cret");
    const { createDashSessionToken, verifyDashSessionToken } = await loadDashSession();
    const token = createDashSessionToken("dash1", "read");

    vi.advanceTimersByTime(10 * 60 * 1000 + 1);

    expect(verifyDashSessionToken("dash1", token, "read")).toBe(false);
  });
});
