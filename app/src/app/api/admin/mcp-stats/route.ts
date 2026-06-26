import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";

export async function GET(request: NextRequest) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Fetch MCP servers, dashboards, and access rules in parallel
    const [serversSnap, dashboardsSnap, accessSnap] = await Promise.all([
      adminDb.collection("mcp_servers").get(),
      adminDb.collection("dashboards").get(),
      adminDb.collection("mcp_access").get(),
    ]);

    // Build tool → server mapping
    const toolToServer = new Map<string, string>();
    const serverMap = new Map<
      string,
      { id: string; name: string; tools: string[]; active: boolean }
    >();

    // Sort servers by toolCount ascending (matching runtime dedup order:
    // more specific MCPs first, Full Access last)
    const sortedDocs = [...serversSnap.docs].sort(
      (a, b) => ((a.data().toolCount || 0) - (b.data().toolCount || 0))
    );

    for (const doc of sortedDocs) {
      const data = doc.data();
      const tools = (data.tools || []).map(
        (t: { name: string }) => t.name
      );
      serverMap.set(doc.id, {
        id: doc.id,
        name: data.name || doc.id,
        tools,
        active: data.active !== false,
      });
      // First server wins (most specific) — matches runtime dedup
      for (const toolName of tools) {
        if (!toolToServer.has(toolName)) {
          toolToServer.set(toolName, doc.id);
        }
      }
    }

    // Build MCP access map: mcpServerId → { departments, users }
    const accessMap = new Map<
      string,
      { assignedDepartments: string[]; assignedUsers: string[] }
    >();
    for (const doc of accessSnap.docs) {
      const data = doc.data();
      accessMap.set(doc.id, {
        assignedDepartments: data.assignedDepartments || [],
        assignedUsers: data.assignedUsers || [],
      });
    }

    // Scan AI dashboards and cross-reference tools with servers
    const serverStats = new Map<
      string,
      {
        dashboardCount: number;
        userEmails: Set<string>;
        dashboards: Array<{ id: string; title: string; createdByEmail: string }>;
      }
    >();

    // Initialize stats for all servers
    for (const [id] of serverMap) {
      serverStats.set(id, {
        dashboardCount: 0,
        userEmails: new Set(),
        dashboards: [],
      });
    }

    let aiDashboardCount = 0;

    for (const doc of dashboardsSnap.docs) {
      const data = doc.data();
      if (data.source !== "ai") continue;

      aiDashboardCount++;
      const queries: Array<{ tool: string; mcpServerId?: string }> = data.aiRecipe?.queries || [];

      // Find which servers are used by this dashboard.
      // Prefer authoritative mcpServerId from query (set at generation time),
      // fall back to tool-name-based lookup for legacy data.
      const usedServerIds = new Set<string>();
      for (const q of queries) {
        if (q.mcpServerId) {
          // Authoritative: use recorded server ID.
          // If server was deleted, skip — do NOT fall back to tool-name
          // lookup, which would misattribute to a different server.
          if (serverMap.has(q.mcpServerId)) {
            usedServerIds.add(q.mcpServerId);
          }
        } else {
          // Legacy data without mcpServerId: best-effort tool-name lookup
          const serverId = toolToServer.get(q.tool);
          if (serverId) usedServerIds.add(serverId);
        }
      }

      for (const serverId of usedServerIds) {
        const stats = serverStats.get(serverId);
        if (stats) {
          stats.dashboardCount++;
          if (data.createdByEmail) stats.userEmails.add(data.createdByEmail);
          stats.dashboards.push({
            id: doc.id,
            title: data.title || "Untitled",
            createdByEmail: data.createdByEmail || "Unknown",
          });
        }
      }
    }

    // Build response
    const stats = Array.from(serverMap.entries()).map(([id, server]) => {
      const s = serverStats.get(id)!;
      const access = accessMap.get(id);
      return {
        mcpServerId: id,
        name: server.name,
        active: server.active,
        toolCount: server.tools.length,
        dashboardCount: s.dashboardCount,
        userCount: s.userEmails.size,
        dashboards: s.dashboards,
        assignedDepartments: access?.assignedDepartments || [],
        assignedUsers: access?.assignedUsers || [],
      };
    });

    const activeServerCount = Array.from(serverMap.values()).filter(
      (s) => s.active
    ).length;

    return NextResponse.json({
      stats,
      summary: {
        aiDashboardCount,
        activeServerCount,
        totalServerCount: serverMap.size,
      },
    });
  } catch (error) {
    console.error("Admin MCP stats failed:", error);
    return NextResponse.json(
      { error: "Failed to load MCP stats" },
      { status: 500 }
    );
  }
}
