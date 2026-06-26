/**
 * Scope Signature — HMAC signing for database scope context.
 *
 * When app-db operations need to be routed through external services
 * (future: dedicated DB MCP, webhooks), the backend signs the scope
 * context so the receiving service can verify it wasn't tampered with.
 *
 * For the current local executor path, this is not needed but is
 * included for forward compatibility.
 */

import { createHmac } from "crypto";

const ALGORITHM = "sha256";

/**
 * Sign a database scope context.
 */
export function signScope(
  userId: string,
  dashboardId: string,
  schema: string,
  tablePrefix: string,
  secret: string
): string {
  const payload = `${userId}:${dashboardId}:${schema}:${tablePrefix}`;
  return createHmac(ALGORITHM, secret).update(payload).digest("hex");
}

/**
 * Verify a database scope signature.
 */
export function verifyScope(
  userId: string,
  dashboardId: string,
  schema: string,
  tablePrefix: string,
  signature: string,
  secret: string
): boolean {
  const expected = signScope(userId, dashboardId, schema, tablePrefix, secret);
  // Constant-time comparison
  if (expected.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Build signed headers for a database scope context.
 * These headers are injected by the backend when forwarding to external services.
 */
export function buildScopeHeaders(
  userId: string,
  userEmail: string,
  dashboardId: string,
  schema: string,
  tablePrefix: string,
  secret: string
): Record<string, string> {
  return {
    "X-Talk With Data-User-Id": userId,
    "X-Talk With Data-User-Email": userEmail,
    "X-Talk With Data-Dashboard-Id": dashboardId,
    "X-Talk With Data-Schema": schema,
    "X-Talk With Data-Table-Prefix": tablePrefix,
    "X-Talk With Data-Scope-Signature": signScope(userId, dashboardId, schema, tablePrefix, secret),
  };
}
