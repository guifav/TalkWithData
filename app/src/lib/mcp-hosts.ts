/**
 * Allowed MCP server hosts.
 *
 * Only endpoints on these hosts will receive the MCP_API_KEY during sync
 * operations. Prevents SSRF and credential leakage to arbitrary URLs
 * registered by superadmins.
 *
 * Configure MCP_ALLOWED_HOSTS as a comma-separated host allowlist. An empty
 * value means no hosts are allowed, which disables MCP calls by design.
 */

function getAllowedHosts(): Set<string> {
  return new Set(
    (process.env.MCP_ALLOWED_HOSTS || "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Check if a URL's host is in the MCP allowlist.
 * Returns false for invalid URLs or non-allowed hosts.
 */
export function isAllowedMcpHost(endpoint: string | undefined): boolean {
  if (!endpoint) return false;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return false;
    return getAllowedHosts().has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}
