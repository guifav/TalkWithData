import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getAllowedAuthDomain } from "@/lib/auth-domain";
import { config, proxy } from "@/proxy";

vi.mock("@/lib/auth-domain", () => ({
  getAllowedAuthDomain: vi.fn(() => "example.com"),
}));

function makeRequest(pathname: string) {
  return new NextRequest(new URL(pathname, "http://localhost"));
}

describe("proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the application matcher on the Next.js proxy convention", () => {
    expect(config.matcher).toEqual(["/((?!_next/static|_next/image|favicon.ico).*)"]);
  });

  it.each(["/login", "/api/auth/session", "/api/health"])(
    "allows public path %s",
    (pathname) => {
      const response = proxy(makeRequest(pathname));

      expect(response.status).toBe(200);
      expect(getAllowedAuthDomain).toHaveBeenCalledTimes(1);
    }
  );

  it("runs the auth domain guard for protected app paths", () => {
    const response = proxy(makeRequest("/dashboards"));

    expect(response.status).toBe(200);
    expect(getAllowedAuthDomain).toHaveBeenCalledTimes(1);
  });
});
