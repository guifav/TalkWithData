import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
process.env.ALLOWED_AUTH_DOMAIN = "example.com";
process.env.STORAGE_BUCKET_NAME = "test-bucket";

// Mock the Firebase admin module before importing api-auth.
// adminAuth and adminDb are consumed via module-level import in api-auth.ts,
// so we need to mock the module they come from.
const mockVerifyIdToken = vi.fn();

// Shared Firestore mock — returns empty collections by default (sufficient for auth gating)
const mockCollectionGet = vi.fn().mockResolvedValue({ docs: [] });
const mockDocGet = vi.fn().mockResolvedValue({ exists: false, data: () => null });
const mockOrderBy = vi.fn().mockReturnValue({ get: mockCollectionGet });

vi.mock("@/lib/firebase/admin", () => ({
  adminAuth: {
    verifyIdToken: mockVerifyIdToken,
  },
  adminDb: {
    collection: () => ({
      doc: () => ({
        get: mockDocGet,
      }),
      get: mockCollectionGet,
      orderBy: mockOrderBy,
    }),
  },
}));

// Mock mcp-hosts for mcp-servers route
vi.mock("@/lib/mcp-hosts", () => ({
  isAllowedMcpHost: () => true,
}));

// Import after mocking
const { verifyRequest, verifyAdmin, verifySuperAdmin } = await import("@/lib/api-auth");

function makeRequest(token?: string, method = "GET", url = "http://localhost/api/admin/test"): NextRequest {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return new NextRequest(url, { method, headers });
}

function setupAuth(role: "user" | "admin" | "superadmin") {
  mockVerifyIdToken.mockResolvedValueOnce({
    uid: `uid-${role}`,
    email: `${role}@example.com`,
    name: `Test ${role}`,
  });
  mockDocGet.mockResolvedValueOnce({
    exists: true,
    data: () => ({ role }),
  });
}

beforeEach(() => {
  process.env.ALLOWED_AUTH_DOMAIN = "example.com";
  vi.clearAllMocks();
  mockCollectionGet.mockResolvedValue({ docs: [] });
  mockOrderBy.mockReturnValue({ get: mockCollectionGet });
});

// ── verifyRequest ──────────────────────────────────────────────────────────

describe("verifyRequest", () => {
  it("returns null when no token is provided", async () => {
    const result = await verifyRequest(makeRequest());
    expect(result).toBeNull();
  });

  it("returns null when token is for non-example.com domain", async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: "uid-1",
      email: "user@gmail.com",
    });
    const result = await verifyRequest(makeRequest("some-token"));
    expect(result).toBeNull();
  });

  it("returns AuthResult for valid example.com token", async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: "uid-1",
      email: "user@example.com",
      name: "Test User",
    });
    const result = await verifyRequest(makeRequest("valid-token"));
    expect(result).not.toBeNull();
    expect(result?.uid).toBe("uid-1");
    expect(result?.email).toBe("user@example.com");
  });

  it("throws when ALLOWED_AUTH_DOMAIN is missing", async () => {
    const previous = process.env.ALLOWED_AUTH_DOMAIN;
    delete process.env.ALLOWED_AUTH_DOMAIN;
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: "uid-1",
      email: "user@example.com",
      name: "Test User",
    });

    await expect(verifyRequest(makeRequest("valid-token"))).rejects.toThrow(
      "ALLOWED_AUTH_DOMAIN env var is required"
    );

    process.env.ALLOWED_AUTH_DOMAIN = previous;
  });
});

// ── verifyAdmin ─────────────────────────────────────────────────────────────

describe("verifyAdmin", () => {
  it("returns null for unauthenticated requests", async () => {
    const result = await verifyAdmin(makeRequest());
    expect(result).toBeNull();
  });

  it("returns null for users with role 'user'", async () => {
    setupAuth("user");
    const result = await verifyAdmin(makeRequest("token"));
    expect(result).toBeNull();
  });

  it("returns AuthResult for users with role 'admin'", async () => {
    setupAuth("admin");
    const result = await verifyAdmin(makeRequest("token"));
    expect(result).not.toBeNull();
    expect(result?.role).toBe("admin");
  });

  it("returns AuthResult for users with role 'superadmin'", async () => {
    setupAuth("superadmin");
    const result = await verifyAdmin(makeRequest("token"));
    expect(result).not.toBeNull();
    expect(result?.role).toBe("superadmin");
  });
});

// ── verifySuperAdmin ────────────────────────────────────────────────────────

describe("verifySuperAdmin", () => {
  it("returns null for unauthenticated requests", async () => {
    const result = await verifySuperAdmin(makeRequest());
    expect(result).toBeNull();
  });

  it("returns null for users with role 'user'", async () => {
    setupAuth("user");
    const result = await verifySuperAdmin(makeRequest("token"));
    expect(result).toBeNull();
  });

  it("returns null for users with role 'admin' (not superadmin)", async () => {
    setupAuth("admin");
    const result = await verifySuperAdmin(makeRequest("token"));
    expect(result).toBeNull();
  });

  it("returns AuthResult for users with role 'superadmin'", async () => {
    setupAuth("superadmin");
    const result = await verifySuperAdmin(makeRequest("token"));
    expect(result).not.toBeNull();
    expect(result?.role).toBe("superadmin");
  });

  it("returns null when verifyIdToken throws (invalid token)", async () => {
    mockVerifyIdToken.mockRejectedValueOnce(new Error("invalid token"));
    const result = await verifySuperAdmin(makeRequest("bad-token"));
    expect(result).toBeNull();
  });
});

// ── Route-level access control ──────────────────────────────────────────────
// These tests import the actual route handlers and verify they return
// 401/403 for non-superadmin callers. This catches regressions where
// a route stops calling verifySuperAdmin or changes the error status.

describe("Admin route access control — GET", () => {
  const routes = [
    { name: "mcp-stats", path: "@/app/api/admin/mcp-stats/route" },
    { name: "mcp-servers", path: "@/app/api/admin/mcp-servers/route" },
    { name: "mcp-access", path: "@/app/api/admin/mcp-access/route" },
    { name: "departments", path: "@/app/api/admin/departments/route" },
  ];

  for (const route of routes) {
    describe(`GET /api/admin/${route.name}`, () => {
      it("rejects unauthenticated requests with 401 or 403", async () => {
        const mod = await import(route.path);
        const req = makeRequest(undefined, "GET", `http://localhost/api/admin/${route.name}`);
        const res = await mod.GET(req);
        expect([401, 403]).toContain(res.status);
      });

      it("rejects admin (non-superadmin) with 401 or 403", async () => {
        setupAuth("admin");
        const mod = await import(route.path);
        const req = makeRequest("admin-token", "GET", `http://localhost/api/admin/${route.name}`);
        const res = await mod.GET(req);
        expect([401, 403]).toContain(res.status);
      });

      it("allows superadmin access (2xx)", async () => {
        setupAuth("superadmin");
        const mod = await import(route.path);
        const req = makeRequest("super-token", "GET", `http://localhost/api/admin/${route.name}`);
        const res = await mod.GET(req);
        expect(res.status).toBeLessThan(400);
      });
    });
  }
});

// ── Mutation route access control ───────────────────────────────────────────
// Tests POST/PATCH/DELETE handlers for superadmin-only routes.
// Mutation requests use minimal/empty JSON bodies — we only care about the
// auth gate firing before any business logic.

function makeJsonRequest(method: string, url: string, token?: string, body?: unknown): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return new NextRequest(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("Admin route access control — mutations", () => {
  const mutations: Array<{
    name: string;
    path: string;
    method: "POST" | "PATCH" | "DELETE";
    handler: string;
    body?: unknown;
  }> = [
    { name: "mcp-servers POST", path: "@/app/api/admin/mcp-servers/route", method: "POST", handler: "POST", body: { name: "test", host: "https://example.com" } },
    { name: "mcp-servers PATCH", path: "@/app/api/admin/mcp-servers/route", method: "PATCH", handler: "PATCH", body: { id: "x", active: false } },
    { name: "mcp-servers DELETE", path: "@/app/api/admin/mcp-servers/route", method: "DELETE", handler: "DELETE", body: { id: "x" } },
    { name: "mcp-access POST", path: "@/app/api/admin/mcp-access/route", method: "POST", handler: "POST", body: { mcpServerId: "x" } },
    { name: "departments POST", path: "@/app/api/admin/departments/route", method: "POST", handler: "POST", body: { name: "test" } },
    { name: "departments PATCH", path: "@/app/api/admin/departments/route", method: "PATCH", handler: "PATCH", body: { id: "x", name: "test" } },
    { name: "departments DELETE", path: "@/app/api/admin/departments/route", method: "DELETE", handler: "DELETE", body: { id: "x" } },
    { name: "mcp-servers/sync POST", path: "@/app/api/admin/mcp-servers/sync/route", method: "POST", handler: "POST", body: { mcpServerId: "x" } },
    { name: "mcp-servers/seed POST", path: "@/app/api/admin/mcp-servers/seed/route", method: "POST", handler: "POST", body: {} },
  ];

  for (const m of mutations) {
    describe(`${m.method} /api/admin/${m.name}`, () => {
      it("rejects unauthenticated requests with 401 or 403", async () => {
        const mod = await import(m.path);
        const req = makeJsonRequest(m.method, `http://localhost/api/admin/${m.name}`, undefined, m.body);
        const res = await mod[m.handler](req);
        expect([401, 403]).toContain(res.status);
      });

      it("rejects admin (non-superadmin) with 401 or 403", async () => {
        setupAuth("admin");
        const mod = await import(m.path);
        const req = makeJsonRequest(m.method, `http://localhost/api/admin/${m.name}`, "admin-token", m.body);
        const res = await mod[m.handler](req);
        expect([401, 403]).toContain(res.status);
      });
    });
  }
});
