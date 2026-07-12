import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
process.env.ALLOWED_AUTH_DOMAIN = "example.com";
process.env.STORAGE_BUCKET_NAME = "test-bucket";

const mockVerifyIdToken = vi.fn();
const mockCreateEmbedToken = vi.fn();
const mockUserUpdate = vi.fn();
const mockPendingGet = vi.fn();
const mockPendingDelete = vi.fn();
const mockDashboardGet = vi.fn();
const mockDashboardUpdate = vi.fn();
const mockConversationGet = vi.fn();
const mockConversationSet = vi.fn();
const mockCheckUserHasMcpAccess = vi.fn();

type Role = "user" | "admin" | "superadmin";

const authUser = {
  uid: "uid-user",
  email: "user@example.com",
  name: "Test User",
};

const userDocs = new Map<string, { exists: boolean; data: Record<string, unknown> }>();

function snapshot(exists: boolean, data: Record<string, unknown> = {}) {
  return {
    exists,
    data: () => data,
    ref: { delete: mockPendingDelete },
  };
}

vi.mock("@/lib/firebase/admin", () => ({
  adminAuth: {
    verifyIdToken: mockVerifyIdToken,
  },
  adminDb: {
    collection: (collectionName: string) => ({
      doc: (id: string) => {
        if (collectionName === "users") {
          return {
            get: () => {
              const doc = userDocs.get(id);
              return Promise.resolve(snapshot(doc?.exists ?? false, doc?.data));
            },
            update: mockUserUpdate,
          };
        }

        if (collectionName === "pendingRoles") {
          return {
            get: mockPendingGet,
          };
        }

        if (collectionName === "dashboards") {
          return {
            get: mockDashboardGet,
            update: mockDashboardUpdate,
            collection: (subcollectionName: string) => ({
              doc: (docId: string) => ({
                get:
                  subcollectionName === "conversations" && docId === "main"
                    ? mockConversationGet
                    : vi.fn().mockResolvedValue(snapshot(false)),
                set:
                  subcollectionName === "conversations" && docId === "main"
                    ? mockConversationSet
                    : vi.fn().mockResolvedValue(undefined),
              }),
            }),
          };
        }

        return {
          get: vi.fn().mockResolvedValue(snapshot(false)),
          update: vi.fn().mockResolvedValue(undefined),
          set: vi.fn().mockResolvedValue(undefined),
        };
      },
      get: vi.fn().mockResolvedValue({ docs: [], empty: true }),
      where: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ docs: [], empty: true }),
      }),
    }),
  },
}));

vi.mock("@/lib/embed-tokens", () => ({
  createEmbedToken: mockCreateEmbedToken,
}));

vi.mock("@/lib/mcp-access", () => ({
  checkUserHasMcpAccess: mockCheckUserHasMcpAccess,
}));

const { POST: initAuth } = await import("@/app/api/auth/init/route");
const { PATCH: patchAdminUsers } = await import("@/app/api/admin/users/route");
const { PATCH: patchDashboard } = await import("@/app/api/dashboards/[id]/route");
const { POST: createEmbedToken } = await import("@/app/api/dashboards/[id]/embed-token/route");
const {
  GET: getDashboardConversation,
  POST: saveDashboardConversation,
} = await import("@/app/api/dashboards/[id]/conversation/route");

function authedRequest(method: string, url: string, body?: unknown): NextRequest {
  const headers: Record<string, string> = { Authorization: "Bearer token" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  return new NextRequest(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function setAuth(role: Role, uid = authUser.uid) {
  mockVerifyIdToken.mockResolvedValue({
    ...authUser,
    uid,
  });
  userDocs.set(uid, { exists: true, data: { role } });
}

beforeEach(() => {
  vi.clearAllMocks();
  userDocs.clear();
  mockVerifyIdToken.mockResolvedValue(authUser);
  mockUserUpdate.mockResolvedValue(undefined);
  mockPendingGet.mockResolvedValue(snapshot(false));
  mockPendingDelete.mockResolvedValue(undefined);
  mockDashboardUpdate.mockResolvedValue(undefined);
  mockCreateEmbedToken.mockResolvedValue("embed-token");
  mockCheckUserHasMcpAccess.mockResolvedValue(true);
  mockDashboardGet.mockResolvedValue(
    snapshot(true, {
      createdBy: authUser.uid,
      visibility: "specific",
      allowedEmails: [],
      allowedDepartments: [],
      storagePath: "dashboards/uid-user/dash/index.html",
      source: "ai",
    })
  );
  mockConversationGet.mockResolvedValue(
    snapshot(true, {
      messages: [{ role: "user", content: "Build a dashboard" }],
      parsedFiles: [],
    })
  );
  mockConversationSet.mockResolvedValue(undefined);
});

describe("role contract routes", () => {
  it("rejects unauthenticated auth initialization before Firestore writes", async () => {
    const res = await initAuth(
      new NextRequest("http://localhost/api/auth/init", { method: "POST" }),
    );

    expect(res.status).toBe(401);
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("fails closed when the user document does not exist", async () => {
    const res = await initAuth(authedRequest("POST", "http://localhost/api/auth/init"));

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      error: "User document not found. Please try again.",
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("keeps an existing role idempotently", async () => {
    userDocs.set(authUser.uid, { exists: true, data: { role: "admin" } });

    const res = await initAuth(authedRequest("POST", "http://localhost/api/auth/init"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ role: "admin", alreadySet: true });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("assigns user by default on first login when pendingRoles has no match", async () => {
    userDocs.set(authUser.uid, { exists: true, data: {} });

    const res = await initAuth(authedRequest("POST", "http://localhost/api/auth/init"));

    expect(res.status).toBe(200);
    expect(mockUserUpdate).toHaveBeenCalledWith({ role: "user" });
  });

  it("applies a valid pending role and tolerates cleanup failure", async () => {
    userDocs.set(authUser.uid, { exists: true, data: {} });
    mockPendingGet.mockResolvedValue(snapshot(true, { role: "admin" }));
    mockPendingDelete.mockRejectedValue(new Error("cleanup unavailable"));

    const res = await initAuth(authedRequest("POST", "http://localhost/api/auth/init"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ role: "admin", alreadySet: false });
    expect(mockUserUpdate).toHaveBeenCalledWith({ role: "admin" });
    expect(mockPendingDelete).toHaveBeenCalledOnce();
  });

  it("rejects admin callers changing another user's role", async () => {
    setAuth("admin");
    userDocs.set("target-uid", { exists: true, data: { role: "user" } });

    const res = await patchAdminUsers(
      authedRequest("PATCH", "http://localhost/api/admin/users", {
        uid: "target-uid",
        role: "admin",
      })
    );

    expect(res.status).toBe(403);
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("allows superadmin callers changing another user's role", async () => {
    setAuth("superadmin");
    userDocs.set("target-uid", { exists: true, data: { role: "user" } });

    const res = await patchAdminUsers(
      authedRequest("PATCH", "http://localhost/api/admin/users", {
        uid: "target-uid",
        role: "admin",
      })
    );

    expect(res.status).toBe(200);
    expect(mockUserUpdate).toHaveBeenCalledWith({ role: "admin" });
  });

  it("rejects superadmin callers changing their own role", async () => {
    setAuth("superadmin");

    const res = await patchAdminUsers(
      authedRequest("PATCH", "http://localhost/api/admin/users", {
        uid: authUser.uid,
        role: "admin",
      })
    );

    expect(res.status).toBe(403);
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("allows a user with dashboard access to create an embed token", async () => {
    setAuth("user");

    const res = await createEmbedToken(
      authedRequest("POST", "http://localhost/api/dashboards/dash-id/embed-token"),
      { params: Promise.resolve({ id: "dash-id" }) }
    );

    expect(res.status).toBe(200);
    expect(mockCreateEmbedToken).toHaveBeenCalledWith("dash-id", expect.objectContaining({
      uid: authUser.uid,
      email: authUser.email,
    }));
  });

  it("allows admin users to update sharing for dashboards shared with them", async () => {
    setAuth("admin");
    mockDashboardGet.mockResolvedValue(
      snapshot(true, {
        createdBy: "owner-uid",
        visibility: "specific",
        allowedEmails: [authUser.email],
        allowedDepartments: [],
      })
    );

    const res = await patchDashboard(
      authedRequest("PATCH", "http://localhost/api/dashboards/dash-id", {
        visibility: "specific",
        allowedEmails: [authUser.email, "new.person@example.com"],
        allowedDepartments: [],
      }),
      { params: Promise.resolve({ id: "dash-id" }) }
    );

    expect(res.status).toBe(200);
    expect(mockDashboardUpdate).toHaveBeenCalledWith(expect.objectContaining({
      visibility: "specific",
      allowedEmails: [authUser.email, "new.person@example.com"],
      allowedDepartments: [],
    }));
  });

  it("rejects non-admin users updating sharing for dashboards shared with them", async () => {
    setAuth("user");
    mockDashboardGet.mockResolvedValue(
      snapshot(true, {
        createdBy: "owner-uid",
        visibility: "specific",
        allowedEmails: [authUser.email],
        allowedDepartments: [],
      })
    );

    const res = await patchDashboard(
      authedRequest("PATCH", "http://localhost/api/dashboards/dash-id", {
        visibility: "specific",
        allowedEmails: [authUser.email, "new.person@example.com"],
      }),
      { params: Promise.resolve({ id: "dash-id" }) }
    );

    expect(res.status).toBe(403);
    expect(mockDashboardUpdate).not.toHaveBeenCalled();
  });

  it("allows the dashboard owner with user role to read the saved AI conversation", async () => {
    setAuth("user");

    const res = await getDashboardConversation(
      authedRequest("GET", "http://localhost/api/dashboards/dash-id/conversation"),
      { params: Promise.resolve({ id: "dash-id" }) }
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      messages: [{ role: "user", content: "Build a dashboard" }],
      parsedFiles: [],
    });
  });

  it("rejects a dashboard owner without MCP access reading the saved AI conversation", async () => {
    setAuth("user");
    mockCheckUserHasMcpAccess.mockResolvedValue(false);

    const res = await getDashboardConversation(
      authedRequest("GET", "http://localhost/api/dashboards/dash-id/conversation"),
      { params: Promise.resolve({ id: "dash-id" }) }
    );

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: "MCP access required",
    });
  });

  it("allows the dashboard owner with user role to save the AI conversation", async () => {
    setAuth("user");

    const res = await saveDashboardConversation(
      authedRequest("POST", "http://localhost/api/dashboards/dash-id/conversation", {
        messages: [{ role: "user", content: "Build a dashboard" }],
      }),
      { params: Promise.resolve({ id: "dash-id" }) }
    );

    expect(res.status).toBe(200);
    expect(mockConversationSet).toHaveBeenCalledWith({
      messages: [{ role: "user", content: "Build a dashboard" }],
      updatedAt: expect.any(String),
    });
  });

  it("rejects a dashboard owner without MCP access saving the AI conversation", async () => {
    setAuth("user");
    mockCheckUserHasMcpAccess.mockResolvedValue(false);

    const res = await saveDashboardConversation(
      authedRequest("POST", "http://localhost/api/dashboards/dash-id/conversation", {
        messages: [{ role: "user", content: "Build a dashboard" }],
      }),
      { params: Promise.resolve({ id: "dash-id" }) }
    );

    expect(res.status).toBe(403);
    expect(mockConversationSet).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toEqual({
      error: "MCP access required",
    });
  });
});
