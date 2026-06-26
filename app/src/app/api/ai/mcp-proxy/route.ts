import { NextRequest, NextResponse } from "next/server";
import { isAllowedMcpHost } from "@/lib/mcp-hosts";

/**
 * MCP Proxy — internal-only route for server-to-server MCP calls.
 *
 * NOT callable from the browser. Protected by X-Internal-Key header
 * that only the chat route knows (derived from CULKIN_MCP_API_KEY).
 * This prevents authenticated users from bypassing MCP access control
 * by calling the proxy directly.
 */
export async function POST(request: NextRequest) {
  // Internal-only: verify caller is our own chat route, not a browser
  const internalKey = request.headers.get("x-internal-key");
  const expectedKey = process.env.CULKIN_MCP_API_KEY;
  if (!internalKey || !expectedKey || internalKey !== expectedKey) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const mcpKey = process.env.CULKIN_MCP_API_KEY;

  if (!mcpKey) {
    console.error("[MCP Proxy] Missing CULKIN_MCP_API_KEY");
    return NextResponse.json(
      { error: "MCP service not configured" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { method, params, endpoint } = body as {
      method: string;
      params?: Record<string, unknown>;
      endpoint?: string;
    };

    if (!method) {
      return NextResponse.json(
        { error: "method is required" },
        { status: 400 }
      );
    }

    // Resolve target URL: explicit endpoint or fallback to env
    const targetUrl = endpoint || process.env.CULKIN_MCP_URL;
    if (!targetUrl) {
      return NextResponse.json(
        { error: "No MCP endpoint provided and CULKIN_MCP_URL not set" },
        { status: 400 }
      );
    }

    // Validate endpoint against allowlist
    if (!isAllowedMcpHost(targetUrl)) {
      return NextResponse.json(
        { error: `Endpoint not allowed: ${targetUrl}` },
        { status: 403 }
      );
    }

    // Culkin MCP Full expects tools/call with { name, arguments }
    // We wrap the tool name into the standard MCP protocol
    const jsonRpcPayload = {
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: {
        name: method,
        arguments: params ?? {},
      },
    };

    const mcpRes = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": mcpKey,
      },
      redirect: "error",
      body: JSON.stringify(jsonRpcPayload),
    });

    if (!mcpRes.ok) {
      const text = await mcpRes.text();
      console.error(`[MCP Proxy] MCP returned ${mcpRes.status}: ${text}`);
      return NextResponse.json(
        { error: "MCP request failed", status: mcpRes.status, detail: text },
        { status: 502 }
      );
    }

    const data = await mcpRes.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[MCP Proxy] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
