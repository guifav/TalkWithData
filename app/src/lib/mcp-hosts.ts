/**
 * Allowed MCP server hosts.
 *
 * Only endpoints on these hosts will receive the MCP_MCP_API_KEY
 * during sync operations. Prevents SSRF and credential leakage to
 * arbitrary URLs registered by superadmins.
 *
 * Update this list when adding new trusted MCP hosts.
 */

const ALLOWED_HOSTS = new Set([
  "mcp.example.com",
  "analytics-app-vozqw3capa-rj.a.run.app", // Cloud Run direct
]);

/**
 * Check if a URL's host is in the MCP allowlist.
 * Returns false for invalid URLs or non-allowed hosts.
 */
export function isAllowedMcpHost(endpoint: string | undefined): boolean {
  if (!endpoint) return false;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return false;
    return ALLOWED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}
