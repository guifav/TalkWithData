import { isAllowedMcpHost } from "@/lib/mcp-hosts";

/**
 * Call an MCP tool via JSON-RPC. Shared by AI chat routes and refresh.
 */
export async function callMcpTool(
  toolName: string,
  args: Record<string, unknown>,
  endpoint: string
): Promise<string> {
  const mcpKey = process.env.CULKIN_MCP_API_KEY;
  if (!mcpKey) {
    return JSON.stringify({ error: "MCP API key not configured" });
  }

  if (!isAllowedMcpHost(endpoint)) {
    return JSON.stringify({ error: `Endpoint not allowed: ${endpoint}` });
  }

  try {
    const jsonRpcPayload = {
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args,
      },
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": mcpKey,
      },
      redirect: "error",
      body: JSON.stringify(jsonRpcPayload),
    });

    if (!res.ok) {
      const text = await res.text();
      return JSON.stringify({ error: `MCP call failed: ${res.status}`, detail: text });
    }

    const data = await res.json();
    if (data.result !== undefined) {
      const result = data.result;
      if (result.content && Array.isArray(result.content)) {
        const textBlock = result.content.find(
          (c: { type: string }) => c.type === "text"
        );
        if (textBlock?.text) return textBlock.text;
      }
      return typeof result === "string" ? result : JSON.stringify(result);
    }
    if (data.error) {
      return JSON.stringify({ error: data.error });
    }
    return JSON.stringify(data);
  } catch (err) {
    return JSON.stringify({
      error: `MCP call error: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}
