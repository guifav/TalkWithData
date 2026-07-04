import { afterEach, describe, expect, it, vi } from "vitest";

async function loadDashSession() {
  vi.resetModules();
  return import("@/lib/dash-session");
}

afterEach(() => {
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
    expect(createDashSessionToken("dash1")).toBe(a);
    expect(verifyDashSessionToken("dash1", a)).toBe(true);
  });

  it("rejects tokens presented for a different scope", async () => {
    vi.stubEnv("DASHBOARD_SESSION_SECRET", "s3cret");
    const { createDashSessionToken, verifyDashSessionToken } = await loadDashSession();
    const readToken = createDashSessionToken("dash1", "read");
    expect(verifyDashSessionToken("dash1", readToken, "write")).toBe(false);
  });
});
