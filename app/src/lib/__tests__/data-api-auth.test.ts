import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { AppDbInstance } from "@prisma/client";

process.env.DASHBOARD_SESSION_SECRET = "test-dash-session-secret";

const mockGetInstance = vi.fn();
const mockVerifyRequest = vi.fn();

vi.mock("@/lib/app-db/registry", () => ({
  getInstance: mockGetInstance,
}));

vi.mock("@/lib/api-auth", () => ({
  verifyRequest: mockVerifyRequest,
}));

const { verifyDataApiRequest } = await import("@/lib/data-api-auth");
const { createDashSessionToken } = await import("@/lib/dash-session");

const dashboardId = "dash-1";

// Fixed timestamp (not `new Date()`) so every makeInstance() call is
// byte-identical: the mock setup and the assertion both call makeInstance()
// and must produce deeply-equal objects.
const FIXED_TIMESTAMP = new Date("2026-01-01T00:00:00.000Z");

function makeInstance(overrides: Partial<AppDbInstance> = {}): AppDbInstance {
  return {
    id: "instance-1",
    dashboardId,
    ownerUid: "owner-uid",
    ownerEmail: "owner@example.com",
    userSchema: "usr_abc123",
    tablePrefix: "d_abc123",
    status: "active",
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
    ...overrides,
  };
}

function requestWithCookie(
  method: string,
  cookieDashboardId: string,
  token: string
): NextRequest {
  return new NextRequest(`http://localhost/api/data/${dashboardId}`, {
    method,
    headers: { Cookie: `dash_session_${cookieDashboardId}=${token}` },
  });
}

function requestWithBearer(method: string, token: string): NextRequest {
  return new NextRequest(`http://localhost/api/data/${dashboardId}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetInstance.mockResolvedValue(makeInstance());
  mockVerifyRequest.mockResolvedValue(null);
});

describe("verifyDataApiRequest", () => {
  it("authorizes a GET with a valid read-scope cookie against an active instance", async () => {
    const token = createDashSessionToken(dashboardId, "read");

    const result = await verifyDataApiRequest(requestWithCookie("GET", dashboardId, token), dashboardId);

    expect(result).toEqual({ dashboardId, instance: makeInstance() });
  });

  it("does not authorize a POST using the read-scope cookie", async () => {
    const token = createDashSessionToken(dashboardId, "read");

    const result = await verifyDataApiRequest(requestWithCookie("POST", dashboardId, token), dashboardId);

    expect(result).toBeNull();
  });

  it("returns null when the cookie is scoped to a different dashboardId", async () => {
    const token = createDashSessionToken("other-dash", "read");

    // Cookie name embeds the dashboardId this call is authenticating against,
    // but the token itself was minted for a different dashboard.
    const result = await verifyDataApiRequest(requestWithCookie("GET", dashboardId, token), dashboardId);

    expect(result).toBeNull();
  });

  it("authorizes a POST with a Bearer write-scope token", async () => {
    const token = createDashSessionToken(dashboardId, "write");

    const result = await verifyDataApiRequest(requestWithBearer("POST", token), dashboardId);

    expect(result).toEqual({ dashboardId, instance: makeInstance() });
  });

  it("does not authorize a write with a Bearer read-scope token", async () => {
    const token = createDashSessionToken(dashboardId, "read");
    mockVerifyRequest.mockResolvedValue(null);

    const result = await verifyDataApiRequest(requestWithBearer("POST", token), dashboardId);

    expect(result).toBeNull();
  });

  it("returns null when the session is valid but getInstance returns null", async () => {
    mockGetInstance.mockResolvedValue(null);
    const token = createDashSessionToken(dashboardId, "read");

    const result = await verifyDataApiRequest(requestWithCookie("GET", dashboardId, token), dashboardId);

    expect(result).toBeNull();
  });

  it("returns null when the instance status is draft", async () => {
    mockGetInstance.mockResolvedValue(makeInstance({ status: "draft" }));
    const token = createDashSessionToken(dashboardId, "read");

    const result = await verifyDataApiRequest(requestWithCookie("GET", dashboardId, token), dashboardId);

    expect(result).toBeNull();
  });

  it("returns null when the instance status is deleting", async () => {
    mockGetInstance.mockResolvedValue(makeInstance({ status: "deleting" }));
    const token = createDashSessionToken(dashboardId, "read");

    const result = await verifyDataApiRequest(requestWithCookie("GET", dashboardId, token), dashboardId);

    expect(result).toBeNull();
  });

  describe("Firebase fallback via verifyRequest", () => {
    it("authorizes the dashboard owner uid with no session cookie or bearer dash token", async () => {
      mockVerifyRequest.mockResolvedValue({ uid: "owner-uid", email: "owner@example.com" });

      const result = await verifyDataApiRequest(
        new NextRequest(`http://localhost/api/data/${dashboardId}`, { method: "GET" }),
        dashboardId
      );

      expect(result).toEqual({ dashboardId, instance: makeInstance() });
    });

    it("returns null for a non-owner uid", async () => {
      mockVerifyRequest.mockResolvedValue({ uid: "not-the-owner", email: "someone@example.com" });

      const result = await verifyDataApiRequest(
        new NextRequest(`http://localhost/api/data/${dashboardId}`, { method: "GET" }),
        dashboardId
      );

      expect(result).toBeNull();
    });

    it("returns null when verifyRequest resolves to null", async () => {
      mockVerifyRequest.mockResolvedValue(null);

      const result = await verifyDataApiRequest(
        new NextRequest(`http://localhost/api/data/${dashboardId}`, { method: "GET" }),
        dashboardId
      );

      expect(result).toBeNull();
    });
  });
});
