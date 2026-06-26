/**
 * Tests for admin vs superadmin access control on /admin endpoints.
 *
 * Scope (this file):
 * - HTTP status gating: superadmin-only endpoints reject admin/user/unauth
 * - HTTP status gating: admin-level endpoints reject user/unauth, accept admin+superadmin
 *
 * NOT covered (future work):
 * - Response body inspection: verifying admin-level endpoints don't leak
 *   superadmin-only data (departments, MCP details) in their JSON responses.
 *   Requires realistic Firestore fixtures rather than empty mocks.
 * - UI tab visibility: verifying /admin page hides sensitive tabs for admin role.
 *   Requires React component testing (React Testing Library or similar).
 *
 * Issue #83
 */

import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockVerifyIdToken = vi.fn();
const mockDocGet = vi.fn();
const mockCollectionGet = vi.fn();

vi.mock("@/lib/firebase/admin", () => ({
  adminAuth: {
    verifyIdToken: (...args: unknown[]) => mockVerifyIdToken(...args),
  },
  adminDb: {
    collection: () => ({
      doc: () => ({
        get: () => mockDocGet(),
        set: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        id: "mock-id",
        collection: () => ({
          get: () => mockCollectionGet(),
          doc: () => ({
            get: () => mockDocGet(),
            set: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      }),
      get: () => mockCollectionGet(),
      orderBy: () => ({ get: () => mockCollectionGet() }),
      where: () => ({
        get: () => mockCollectionGet(),
        orderBy: () => ({ get: () => mockCollectionGet() }),
      }),
    }),
    collectionGroup: () => ({
      where: () => ({ get: () => mockCollectionGet() }),
    }),
  },
}));

vi.mock("@/lib/mcp-hosts", () => ({ isAllowedMcpHost: () => true }));

vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy({}, {
    get() {
      return {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      };
    },
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

type Role = "superadmin" | "admin" | "user";

function setupMocks(role: Role | "unauth") {
  mockVerifyIdToken.mockReset();
  mockDocGet.mockReset();
  mockCollectionGet.mockReset();

  mockCollectionGet.mockResolvedValue({ docs: [], empty: true });

  if (role === "unauth") {
    mockVerifyIdToken.mockRejectedValue(new Error("no token"));
    mockDocGet.mockResolvedValue({ exists: false, data: () => null });
  } else {
    mockVerifyIdToken.mockResolvedValue({
      uid: `uid-${role}`,
      email: `${role}@griinstitute.org`,
      name: `Test ${role}`,
    });
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ role, department: "tech" }),
    });
  }
}

function makeReq(
  method: string,
  url: string,
  token = true,
  body?: Record<string, unknown>
): NextRequest {
  const headers = new Headers();
  if (token) headers.set("Authorization", "Bearer valid-token");
  if (body) headers.set("Content-Type", "application/json");
  return new NextRequest(url, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

// ── Import route handlers ────────────────────────────────────────────────────

const { GET: getMcpServers } = await import("@/app/api/admin/mcp-servers/route");
const { GET: getMcpAccess } = await import("@/app/api/admin/mcp-access/route");
const { GET: getDepartments } = await import("@/app/api/admin/departments/route");
const { GET: getMcpStats } = await import("@/app/api/admin/mcp-stats/route");
const { GET: getOverview } = await import("@/app/api/admin/overview/route");
const { GET: getDashboards } = await import("@/app/api/admin/dashboards/route");
const { GET: getUsers } = await import("@/app/api/admin/users/route");
const { GET: getViews } = await import("@/app/api/admin/views/route");
const { GET: getStorage } = await import("@/app/api/admin/storage/route");

// ── Superadmin-only endpoints ─────────────────────────────────────────────────

interface EndpointDef {
  name: string;
  handler: (req: NextRequest) => Promise<Response>;
  method: string;
  url: string;
}

const SUPERADMIN_ONLY: EndpointDef[] = [
  { name: "GET /admin/mcp-servers", handler: getMcpServers, method: "GET", url: "http://localhost/api/admin/mcp-servers" },
  { name: "GET /admin/mcp-access", handler: getMcpAccess, method: "GET", url: "http://localhost/api/admin/mcp-access" },
  { name: "GET /admin/departments", handler: getDepartments, method: "GET", url: "http://localhost/api/admin/departments" },
  { name: "GET /admin/mcp-stats", handler: getMcpStats, method: "GET", url: "http://localhost/api/admin/mcp-stats" },
];

describe("Superadmin-only endpoints", () => {
  for (const ep of SUPERADMIN_ONLY) {
    describe(ep.name, () => {
      it("accepts superadmin", async () => {
        setupMocks("superadmin");
        const res = await ep.handler(makeReq(ep.method, ep.url));
        expect(res.status).toBe(200);
      });

      it("rejects admin", async () => {
        setupMocks("admin");
        const res = await ep.handler(makeReq(ep.method, ep.url));
        expect([401, 403]).toContain(res.status);
      });

      it("rejects user", async () => {
        setupMocks("user");
        const res = await ep.handler(makeReq(ep.method, ep.url));
        expect([401, 403]).toContain(res.status);
      });

      it("rejects unauthenticated", async () => {
        setupMocks("unauth");
        const res = await ep.handler(makeReq(ep.method, ep.url, false));
        expect([401, 403]).toContain(res.status);
      });
    });
  }
});

// ── Admin-level endpoints (admin + superadmin OK) ─────────────────────────────

const ADMIN_LEVEL: EndpointDef[] = [
  { name: "GET /admin/overview", handler: getOverview, method: "GET", url: "http://localhost/api/admin/overview" },
  { name: "GET /admin/dashboards", handler: getDashboards, method: "GET", url: "http://localhost/api/admin/dashboards" },
  { name: "GET /admin/users", handler: getUsers, method: "GET", url: "http://localhost/api/admin/users" },
  { name: "GET /admin/views", handler: getViews, method: "GET", url: "http://localhost/api/admin/views" },
  { name: "GET /admin/storage", handler: getStorage, method: "GET", url: "http://localhost/api/admin/storage" },
];

describe("Admin-level endpoints", () => {
  for (const ep of ADMIN_LEVEL) {
    describe(ep.name, () => {
      it("accepts superadmin", async () => {
        setupMocks("superadmin");
        const res = await ep.handler(makeReq(ep.method, ep.url));
        expect(res.status).toBe(200);
      });

      it("accepts admin", async () => {
        setupMocks("admin");
        const res = await ep.handler(makeReq(ep.method, ep.url));
        expect(res.status).toBe(200);
      });

      it("rejects user", async () => {
        setupMocks("user");
        const res = await ep.handler(makeReq(ep.method, ep.url));
        expect([401, 403]).toContain(res.status);
      });

      it("rejects unauthenticated", async () => {
        setupMocks("unauth");
        const res = await ep.handler(makeReq(ep.method, ep.url, false));
        expect([401, 403]).toContain(res.status);
      });
    });
  }
});
