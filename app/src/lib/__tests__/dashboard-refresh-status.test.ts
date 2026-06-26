import { describe, expect, it } from "vitest";
import { deriveDashboardRefreshStatus } from "@/lib/dashboard-refresh-status";

const NOW = Date.parse("2026-04-29T12:00:00.000Z");
const ONE_HOUR = 60 * 60 * 1000;

describe("deriveDashboardRefreshStatus", () => {
  it("reports recently_completed when the dashboard was refreshed inside the rate limit window", () => {
    const status = deriveDashboardRefreshStatus({
      now: NOW,
      minRefreshIntervalMs: ONE_HOUR,
      lastRefreshedAt: "2026-04-29T11:30:00.000Z",
      refreshLockedUntil: 0,
      refreshJob: { status: "running" },
    });

    expect(status.status).toBe("recently_completed");
    expect(status.lastRefreshedAt).toBe("2026-04-29T11:30:00.000Z");
  });

  it("reports running while the refresh lock is still active", () => {
    const status = deriveDashboardRefreshStatus({
      now: NOW,
      minRefreshIntervalMs: ONE_HOUR,
      lastRefreshedAt: "2026-04-29T09:00:00.000Z",
      refreshLockedUntil: NOW + 15_000,
      refreshJob: { status: "running", startedAt: "2026-04-29T11:59:00.000Z" },
    });

    expect(status.status).toBe("running");
    expect(status.lockedUntil).toBe(new Date(NOW + 15_000).toISOString());
  });

  it("reports failed when a previous background refresh recorded an error", () => {
    const status = deriveDashboardRefreshStatus({
      now: NOW,
      minRefreshIntervalMs: ONE_HOUR,
      lastRefreshedAt: "2026-04-29T09:00:00.000Z",
      refreshLockedUntil: 0,
      refreshJob: { status: "failed", error: "AI failed to generate valid HTML" },
    });

    expect(status).toEqual({
      status: "failed",
      error: "AI failed to generate valid HTML",
      lastRefreshedAt: "2026-04-29T09:00:00.000Z",
    });
  });
});
