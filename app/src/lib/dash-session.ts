import { createHmac, randomUUID } from "crypto";

export type DashSessionScope = "read" | "write";

/**
 * Server-side secret for HMAC-based dashboard session cookies.
 * MUST be set via DASHBOARD_SESSION_SECRET env var (shared across all instances).
 * Falls back to a per-process UUID ONLY for local development — in production
 * this would cause intermittent 401s across Cloud Run instances.
 */
const secret = process.env.DASHBOARD_SESSION_SECRET;
if (!secret && process.env.NODE_ENV === "production") {
  console.error("CRITICAL: DASHBOARD_SESSION_SECRET not set in production. Dashboard session cookies will not work across instances.");
}
export const DASH_SESSION_SECRET = secret || randomUUID();

/**
 * Create an HMAC-SHA256 token for a dashboard session cookie.
 * View/embed sessions are read-only unless an explicit write scope is issued.
 */
export function createDashSessionToken(
  dashboardId: string,
  scope: DashSessionScope = "read"
): string {
  return createHmac("sha256", DASH_SESSION_SECRET)
    .update(`${dashboardId}:${scope}`)
    .digest("hex");
}

/**
 * Verify a dashboard session cookie value for the requested scope.
 */
export function verifyDashSessionToken(
  dashboardId: string,
  token: string,
  scope: DashSessionScope = "read"
): boolean {
  const expected = createDashSessionToken(dashboardId, scope);
  // Constant-time comparison to prevent timing attacks
  if (expected.length !== token.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return mismatch === 0;
}
