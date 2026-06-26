import { describe, expect, it, vi } from "vitest";
process.env.ALLOWED_AUTH_DOMAIN = "example.com";
process.env.STORAGE_BUCKET_NAME = "test-bucket";

async function loadMcpHosts() {
  vi.resetModules();
  return import("@/lib/mcp-hosts");
}

describe("isAllowedMcpHost", () => {
  it("denies every endpoint when MCP_ALLOWED_HOSTS is empty", async () => {
    delete process.env.MCP_ALLOWED_HOSTS;
    const { isAllowedMcpHost } = await loadMcpHosts();

    expect(isAllowedMcpHost("https://mcp.example.com/api/mcp/full")).toBe(false);
  });

  it("allows configured https hosts only", async () => {
    process.env.MCP_ALLOWED_HOSTS = "mcp.example.com, other.example.com";
    const { isAllowedMcpHost } = await loadMcpHosts();

    expect(isAllowedMcpHost("https://mcp.example.com/api/mcp/full")).toBe(true);
    expect(isAllowedMcpHost("http://mcp.example.com/api/mcp/full")).toBe(false);
    expect(isAllowedMcpHost("https://not-allowed.example.com/api/mcp/full")).toBe(false);
  });
});
