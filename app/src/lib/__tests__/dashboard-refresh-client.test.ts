import { describe, expect, it } from "vitest";
import { shouldPollDashboardRefresh } from "@/lib/dashboard-refresh-client";
process.env.ALLOWED_AUTH_DOMAIN = "example.com";
process.env.STORAGE_BUCKET_NAME = "test-bucket";

describe("shouldPollDashboardRefresh", () => {
  it("continues polling after async start states", () => {
    expect(shouldPollDashboardRefresh("started")).toBe(true);
    expect(shouldPollDashboardRefresh("running")).toBe(true);
    expect(shouldPollDashboardRefresh("in_progress")).toBe(true);
  });

  it("stops polling on terminal states", () => {
    expect(shouldPollDashboardRefresh("completed")).toBe(false);
    expect(shouldPollDashboardRefresh("failed")).toBe(false);
    expect(shouldPollDashboardRefresh("recently_completed")).toBe(false);
    expect(shouldPollDashboardRefresh("idle")).toBe(false);
  });
});
