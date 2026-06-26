import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";
import { isAllowedMcpHost } from "@/lib/mcp-hosts";

const COLLECTION = "mcp_servers";

interface SyncResult {
  id: string;
  name: string;
  toolCount: number;
  error?: string;
}

/**
 * POST /api/admin/mcp-servers/sync
 * Sync tools from one or all MCP servers via JSON-RPC tools/list (superadmin).
 * Body: { id?: string }
 */
export async function POST(request: NextRequest) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { id } = body as { id?: string };

    const apiKey = process.env.MCP_MCP_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "MCP_MCP_API_KEY not configured" },
        { status: 500 }
      );
    }

    // Get servers to sync
    let docs;
    if (id) {
      const doc = await adminDb.collection(COLLECTION).doc(id).get();
      if (!doc.exists) {
        return NextResponse.json(
          { error: "MCP server not found" },
          { status: 404 }
        );
      }
      docs = [doc];
    } else {
      const snap = await adminDb
        .collection(COLLECTION)
        .where("active", "==", true)
        .get();
      docs = snap.docs;
    }

    const results: SyncResult[] = [];

    for (const doc of docs) {
      const data = doc.data();
      const result: SyncResult = {
        id: doc.id,
        name: data?.name || "Unknown",
        toolCount: 0,
      };

      try {
        // Validate endpoint host before sending API key
        if (!isAllowedMcpHost(data?.endpoint)) {
          throw new Error(`Endpoint host not in allowlist: ${data?.endpoint}`);
        }

        const res = await fetch(data?.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: "1",
            method: "tools/list",
          }),
          signal: AbortSignal.timeout(15000),
          // Prevent redirect-based API key exfiltration: a 302 to
          // another origin would carry the X-API-Key header in Node.
          redirect: "error",
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const rpcResponse = await res.json();
        if (rpcResponse.error) {
          throw new Error(
            rpcResponse.error.message || JSON.stringify(rpcResponse.error)
          );
        }

        const tools: Array<{ name: string; description: string; inputSchema?: Record<string, unknown> }> = (
          rpcResponse.result?.tools || []
        ).map((t: { name: string; description?: string; inputSchema?: Record<string, unknown> }) => ({
          name: t.name,
          description: t.description || "",
          ...(t.inputSchema ? { inputSchema: t.inputSchema } : {}),
        }));

        const now = new Date().toISOString();
        await doc.ref.update({
          tools,
          toolCount: tools.length,
          lastSyncedAt: now,
          lastSyncError: null,
          updatedAt: now,
        });

        result.toolCount = tools.length;
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Unknown sync error";
        result.error = errorMsg;

        await doc.ref.update({
          lastSyncError: errorMsg,
          updatedAt: new Date().toISOString(),
        });
      }

      results.push(result);
    }

    return NextResponse.json({ synced: results });
  } catch (error) {
    console.error("MCP sync failed:", error);
    return NextResponse.json(
      { error: "Failed to sync MCP servers" },
      { status: 500 }
    );
  }
}
