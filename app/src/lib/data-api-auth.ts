/**
 * Data API Auth, authenticates requests from HTML dashboards
 * to the runtime data endpoints.
 *
 * Uses the dash_session cookie (HMAC-based, scoped per dashboard).
 * Also accepts Firebase Bearer token as fallback (for /create editor).
 *
 * Issue #141
 */

import { NextRequest } from "next/server";
import { verifyDashSessionToken } from "@/lib/dash-session";
import { verifyRequest } from "@/lib/api-auth";
import { getInstance } from "@/lib/app-db/registry";
import type { AppDbInstance } from "@prisma/client";

export interface DataApiAuth {
  dashboardId: string;
  instance: AppDbInstance;
}

/**
 * Authenticate a data API request.
 *
 * Checks (in order):
 * 1. dash_session_{id} cookie (for rendered HTML in browser)
 * 2. Firebase Bearer token (for /create editor and API clients)
 *
 * Also validates the dashboard has an active app-db instance.
 */
export async function verifyDataApiRequest(
  request: NextRequest,
  dashboardId: string
): Promise<DataApiAuth | null> {
  // Method 1: Session cookie (for rendered HTML in browser with same-origin)
  const cookieName = `dash_session_${dashboardId}`;
  const sessionToken = request.cookies.get(cookieName)?.value;
  let authenticated = false;

  const isReadMethod = request.method === "GET" || request.method === "HEAD";

  // Method 1: Session cookie (read-only for sandboxed iframes)
  if (isReadMethod && sessionToken && verifyDashSessionToken(dashboardId, sessionToken, "read")) {
    authenticated = true;
  }

  // Method 1b: Bearer token with dash_session value (for sandboxed iframes without cookies)
  // Sandboxed iframes (sandbox="allow-scripts") have null origin and cannot send cookies.
  // The injected __TWD_DATA_TOKEN__ is the only auth path. It allows all methods because
  // interactive dashboards need POST/PATCH/DELETE. The token is per-dashboard and only
  // accessible to users who can already view the dashboard (permission checked in view route).
  if (!authenticated) {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const bearerToken = authHeader.slice(7);
      if (verifyDashSessionToken(dashboardId, bearerToken, "read")) {
        authenticated = true;
      }
    }
  }

  // Validate app-db instance exists and is active
  const instance = await getInstance(dashboardId);
  if (!instance || instance.status !== "active") {
    return null;
  }

  // Method 2: Firebase Bearer token (must be dashboard owner)
  if (!authenticated) {
    const auth = await verifyRequest(request);
    if (!auth) return null;
    if (auth.uid !== instance.ownerUid) return null;
    authenticated = true;
  }

  if (!authenticated) return null;

  return { dashboardId, instance };
}
