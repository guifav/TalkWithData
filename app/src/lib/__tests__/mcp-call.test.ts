import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callMcpTool } from "@/lib/mcp-call";

const ALLOWED_ENDPOINT = "https://mcp.example.com/api/mcp/full";

beforeEach(() => {
  vi.stubEnv("MCP_API_KEY", "test-mcp-key");
  vi.stubEnv("MCP_ALLOWED_HOSTS", "mcp.example.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("callMcpTool", () => {
  it("returns an error and never calls fetch when MCP_API_KEY is missing", async () => {
    vi.stubEnv("MCP_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await callMcpTool("some_tool", {}, ALLOWED_ENDPOINT);

    expect(JSON.parse(result)).toEqual({ error: "MCP API key not configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses an endpoint off the allowlist and never calls fetch (key must not reach it)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const endpoint = "https://not-allowed.example.com/api/mcp/full";
    const result = await callMcpTool("some_tool", {}, endpoint);

    expect(JSON.parse(result)).toEqual({ error: `Endpoint not allowed: ${endpoint}` });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a plain http:// endpoint even if the host is allowlisted, and never calls fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const endpoint = "http://mcp.example.com/api/mcp/full";
    const result = await callMcpTool("some_tool", {}, endpoint);

    expect(JSON.parse(result)).toEqual({ error: `Endpoint not allowed: ${endpoint}` });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a malformed endpoint (not a URL) and never calls fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const endpoint = "not-a-url";
    const result = await callMcpTool("some_tool", {}, endpoint);

    expect(JSON.parse(result)).toEqual({ error: `Endpoint not allowed: ${endpoint}` });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses every endpoint when the MCP_ALLOWED_HOSTS allowlist is empty, and never calls fetch", async () => {
    vi.stubEnv("MCP_ALLOWED_HOSTS", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await callMcpTool("some_tool", {}, ALLOWED_ENDPOINT);

    expect(JSON.parse(result)).toEqual({ error: `Endpoint not allowed: ${ALLOWED_ENDPOINT}` });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts a JSON-RPC 2.0 tools/call body with the API key header and returns the text content", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          content: [{ type: "text", text: "hello from mcp" }],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callMcpTool("my_tool", { foo: "bar" }, ALLOWED_ENDPOINT);

    expect(result).toBe("hello from mcp");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [calledEndpoint, init] = fetchMock.mock.calls[0];
    expect(calledEndpoint).toBe(ALLOWED_ENDPOINT);
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("error");
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      "X-API-Key": "test-mcp-key",
    });

    const body = JSON.parse(init.body as string);
    expect(body.jsonrpc).toBe("2.0");
    expect(body.method).toBe("tools/call");
    expect(body.params).toEqual({ name: "my_tool", arguments: { foo: "bar" } });
    expect(typeof body.id).toBe("string");
  });

  it("stringifies the result when it has no content array", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { status: "done", count: 3 } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callMcpTool("my_tool", {}, ALLOWED_ENDPOINT);

    expect(JSON.parse(result)).toEqual({ status: "done", count: 3 });
  });

  it("returns a string result as-is when result is a plain string", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: "plain-string-result" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callMcpTool("my_tool", {}, ALLOWED_ENDPOINT);

    expect(result).toBe("plain-string-result");
  });

  it("returns an error message with the status code for a non-ok response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => "upstream failure detail",
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callMcpTool("my_tool", {}, ALLOWED_ENDPOINT);

    expect(JSON.parse(result)).toEqual({
      error: "MCP call failed: 502",
      detail: "upstream failure detail",
    });
  });

  it("stringifies a JSON-RPC error member", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ error: { code: -32601, message: "Method not found" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callMcpTool("my_tool", {}, ALLOWED_ENDPOINT);

    expect(JSON.parse(result)).toEqual({
      error: { code: -32601, message: "Method not found" },
    });
  });

  it("returns an MCP call error message and never throws when fetch rejects", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await callMcpTool("my_tool", {}, ALLOWED_ENDPOINT);

    expect(JSON.parse(result)).toEqual({ error: "MCP call error: network down" });
  });
});
