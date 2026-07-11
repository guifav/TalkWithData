import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkPostgresReadiness } from "@/lib/readiness";
import { GET } from "./route";

vi.mock("@/lib/readiness", () => ({
  checkPostgresReadiness: vi.fn(),
}));

describe("GET /api/ready", () => {
  beforeEach(() => {
    vi.mocked(checkPostgresReadiness).mockReset();
  });

  it("reports readiness when PostgreSQL is available", async () => {
    vi.mocked(checkPostgresReadiness).mockResolvedValue(true);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      status: "ready",
      dependencies: { postgresql: "ok" },
    });
  });

  it("returns a sanitized 503 and recovers on a later request", async () => {
    vi.mocked(checkPostgresReadiness)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const unavailable = await GET();
    const recovered = await GET();

    expect(unavailable.status).toBe(503);
    await expect(unavailable.json()).resolves.toEqual({
      status: "not_ready",
      dependencies: { postgresql: "unavailable" },
    });
    expect(recovered.status).toBe(200);
  });
});
