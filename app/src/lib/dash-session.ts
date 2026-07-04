import { createHmac, randomUUID } from "crypto";

export type DashSessionScope = "read" | "write";

/**
 * Server-side secret for HMAC-based dashboard session cookies.
 * MUST be set via DASHBOARD_SESSION_SECRET env var (shared across all instances).
 * In production a missing secret throws at first use: a per-process fallback
 * would cause intermittent 401s across Cloud Run instances. Local development
 * falls back to a per-process UUID.
 *
 * Resolved lazily, not at import time: `next build` imports route modules with
 * NODE_ENV=production (the Docker builder stage has no secrets) and must not
 * fail. Only minting or verifying a token requires the secret.
 */
let cachedSecret: string | null = null;

function getDashSessionSecret(): string {
  if (cachedSecret !== null) return cachedSecret;

  const secret = process.env.DASHBOARD_SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "DASHBOARD_SESSION_SECRET is not set. Refusing to issue dashboard session tokens in production: a per-process fallback breaks sessions across instances and restarts."
      );
    }
    console.warn(
      "DASHBOARD_SESSION_SECRET not set. Falling back to a per-process secret (development only)."
    );
  }
  cachedSecret = secret || randomUUID();
  return cachedSecret;
}

/**
 * Create an HMAC-SHA256 token for a dashboard session cookie.
 * View/embed sessions are read-only unless an explicit write scope is issued.
 */
export function createDashSessionToken(
  dashboardId: string,
  scope: DashSessionScope = "read"
): string {
  return createHmac("sha256", getDashSessionSecret())
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
