import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockVerifyRequest = vi.fn();
const mockCanViewViaSharedFolder = vi.fn();
const mockStartDashboardRefreshWorker = vi.fn();
const mockDashboardGet = vi.fn();
const mockDashboardUpdate = vi.fn();
const mockTransactionGet = vi.fn();
const mockTransactionUpdate = vi.fn();
const mockRunTransaction = vi.fn();

function snapshot(exists: boolean, data: Record<string, unknown> = {}) {
  return {
    exists,
    data: () => data,
  };
}

vi.mock("@/lib/api-auth", () => ({
  verifyRequest: mockVerifyRequest,
}));

vi.mock("@/lib/permissions", () => ({
  canViewDashboardViaSharedFolder: mockCanViewViaSharedFolder,
}));

vi.mock("@/lib/dashboard-refresh-worker", () => ({
  startDashboardRefreshWorker: mockStartDashboardRefreshWorker,
}));

vi.mock("@/lib/firebase/admin", () => ({
  adminDb: {
    collection: (collectionName: string) => ({
      doc: (id: string) => {
        if (collectionName === "dashboards" && id === "dash-id") {
          return {
            get: mockDashboardGet,
            update: mockDashboardUpdate,
          };
        }

        return {
          get: vi.fn().mockResolvedValue(snapshot(false)),
          update: vi.fn().mockResolvedValue(undefined),
        };
      },
      where: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ docs: [] }),
      }),
    }),
    runTransaction: mockRunTransaction,
  },
}));

const { POST, GET } = await import("@/app/api/dashboards/[id]/refresh/route");

function authedRequest(method: string): NextRequest {
  return new NextRequest("http://localhost/api/dashboards/dash-id/refresh", {
    method,
    headers: { Authorization: "Bearer token" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyRequest.mockResolvedValue({
    uid: "owner-uid",
    email: "owner@griinstitute.org",
    name: "Owner",
  });
  mockCanViewViaSharedFolder.mockResolvedValue({ allowed: false });
  mockDashboardGet.mockResolvedValue(
    snapshot(true, {
      createdBy: "owner-uid",
      visibility: "specific",
      allowedEmails: [],
      allowedDepartments: [],
      source: "ai",
      aiRecipe: {
        generationPrompt: "Build dashboard",
        queries: [{ mcpServerId: "mcp-1" }],
      },
    })
  );
  mockDashboardUpdate.mockResolvedValue(undefined);
  mockTransactionGet.mockResolvedValue(
    snapshot(true, {
      aiRecipe: {
        generationPrompt: "Build dashboard",
        queries: [{ mcpServerId: "mcp-1" }],
      },
    })
  );
  mockTransactionUpdate.mockResolvedValue(undefined);
  mockRunTransaction.mockImplementation(async (callback) =>
    callback({
      get: mockTransactionGet,
      update: mockTransactionUpdate,
    })
  );
  mockStartDashboardRefreshWorker.mockImplementation(() => undefined);
});

describe("dashboard refresh route", () => {
  it("starts refresh work in the background and returns 202 without waiting for generation", async () => {
    const res = await POST(authedRequest("POST"), {
      params: Promise.resolve({ id: "dash-id" }),
    });
    const body = await res.json();

    expect(res.status).toBe(202);
    expect(body.status).toBe("started");
    expect(mockDashboardUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        "refreshJob.status": "running",
        "refreshJob.startedBy": "owner-uid",
        "refreshJob.startedByEmail": "owner@griinstitute.org",
      })
    );
    expect(mockStartDashboardRefreshWorker).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "dash-id",
        auth: expect.objectContaining({ uid: "owner-uid" }),
      })
    );
  });

  it("releases the refresh lock when marking the job as running fails after the claim", async () => {
    mockDashboardUpdate
      .mockRejectedValueOnce(new Error("write failed"))
      .mockResolvedValueOnce(undefined);

    const res = await POST(authedRequest("POST"), {
      params: Promise.resolve({ id: "dash-id" }),
    });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to start dashboard refresh");
    expect(mockTransactionUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ refreshLockedUntil: expect.any(Number) })
    );
    expect(mockDashboardUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        refreshLockedUntil: 0,
        "refreshJob.status": "failed",
        "refreshJob.error": "Failed to start dashboard refresh",
      })
    );
    expect(mockStartDashboardRefreshWorker).not.toHaveBeenCalled();
  });

  it("returns the current refresh status for polling", async () => {
    mockDashboardGet.mockResolvedValueOnce(
      snapshot(true, {
        createdBy: "owner-uid",
        visibility: "specific",
        allowedEmails: [],
        allowedDepartments: [],
        source: "ai",
        refreshLockedUntil: Date.now() + 30_000,
        aiRecipe: {
          generationPrompt: "Build dashboard",
          queries: [{ mcpServerId: "mcp-1" }],
        },
        refreshJob: { status: "running" },
      })
    );

    const res = await GET(authedRequest("GET"), {
      params: Promise.resolve({ id: "dash-id" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("running");
    expect(body.lockedUntil).toEqual(expect.any(String));
  });
});
