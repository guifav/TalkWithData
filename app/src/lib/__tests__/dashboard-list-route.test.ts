import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockVerifyRequest = vi.fn();
const mockDashboardGet = vi.fn();
const mockDepartmentGet = vi.fn();
const mockFolderAccess = vi.fn();

vi.mock("@/lib/api-auth", () => ({ verifyRequest: mockVerifyRequest }));
vi.mock("@/lib/firebase/admin", () => ({
  adminDb: {
    collection: (name: string) => {
      if (name === "dashboards") {
        return { orderBy: () => ({ get: mockDashboardGet }) };
      }
      if (name === "departments") {
        return { where: () => ({ get: mockDepartmentGet }) };
      }
      throw new Error(`Unexpected collection: ${name}`);
    },
  },
}));
vi.mock("@/lib/permissions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/permissions")>();
  return {
    ...actual,
    canViewDashboardViaSharedFolder: mockFolderAccess,
  };
});

const { GET } = await import("@/app/api/dashboards/route");

function dashboardDoc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyRequest.mockResolvedValue({ uid: "owner-uid", email: "owner@example.com" });
  mockDepartmentGet.mockResolvedValue({ docs: [] });
  mockFolderAccess.mockResolvedValue({ allowed: false });
});

describe("GET /api/dashboards active ID resolution", () => {
  it("returns only active dashboards the authenticated user can view", async () => {
    mockDashboardGet.mockResolvedValue({
      docs: [
        dashboardDoc("owned-active", {
          createdBy: "owner-uid",
          visibility: "specific",
          allowedEmails: [],
          allowedDepartments: [],
          archivedAt: null,
        }),
        dashboardDoc("email-active", {
          createdBy: "other-uid",
          visibility: "specific",
          allowedEmails: ["owner@example.com"],
          allowedDepartments: [],
          archivedAt: null,
        }),
        dashboardDoc("owned-archived", {
          createdBy: "owner-uid",
          visibility: "specific",
          allowedEmails: [],
          allowedDepartments: [],
          archivedAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
        dashboardDoc("inaccessible", {
          createdBy: "other-uid",
          visibility: "specific",
          allowedEmails: [],
          allowedDepartments: [],
          archivedAt: null,
        }),
      ],
    });

    const response = await GET(
      new NextRequest("http://localhost/api/dashboards?scope=active-ids"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ids: ["owned-active", "email-active"],
    });
    expect(mockFolderAccess).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated requests", async () => {
    mockVerifyRequest.mockResolvedValue(null);

    const response = await GET(
      new NextRequest("http://localhost/api/dashboards?scope=active-ids"),
    );

    expect(response.status).toBe(401);
  });
});
