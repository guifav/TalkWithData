import { createHmac, randomUUID } from "crypto";

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
 */
export function createDashSessionToken(dashboardId: string): string {
  return createHmac("sha256", DASH_SESSION_SECRET)
    .update(dashboardId)
    .digest("hex");
}

/**
 * Verify a dashboard session cookie value.
 */
export function verifyDashSessionToken(
  dashboardId: string,
  token: string
): boolean {
  const expected = createDashSessionToken(dashboardId);
  // Constant-time comparison to prevent timing attacks
  if (expected.length !== token.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return mismatch === 0;
}
