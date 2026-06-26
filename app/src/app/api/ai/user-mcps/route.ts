import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";

/**
 * GET — Returns MCP servers the current user has access to.
 * Access is granted if the user's department is in `assignedDepartments`
 * OR the user's UID is in `assignedUsers` for a given mcp_access doc.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Get user doc to read department
    const userDoc = await adminDb.collection("users").doc(auth.uid).get();
    const userDepartment: string | undefined = userDoc.data()?.department;

    // 2. Read all mcp_access docs
    const accessSnap = await adminDb.collection("mcp_access").get();

    // 3. Filter: user's department in assignedDepartments OR user's UID in assignedUsers
    const matchingServerIds: string[] = [];
    for (const doc of accessSnap.docs) {
      const data = doc.data() as {
        assignedDepartments?: string[];
        assignedUsers?: string[];
      };
      const depts = data.assignedDepartments || [];
      const users = data.assignedUsers || [];

      if (
        (userDepartment && depts.includes(userDepartment)) ||
        users.includes(auth.uid)
      ) {
        matchingServerIds.push(doc.id); // doc.id = mcpServerId
      }
    }

    if (matchingServerIds.length === 0) {
      return NextResponse.json({ mcpServers: [] });
    }

    // 4. Look up each matching MCP server
    const mcpServers: Array<{
      id: string;
      name: string;
      description: string;
      endpoint: string;
      tools: Array<{ name: string; description: string }>;
      toolCount: number;
    }> = [];

    for (const serverId of matchingServerIds) {
      const serverDoc = await adminDb
        .collection("mcp_servers")
        .doc(serverId)
        .get();
      if (!serverDoc.exists) continue;

      const server = serverDoc.data() as {
        name?: string;
        description?: string;
        endpoint?: string;
        tools?: Array<{ name: string; description: string }>;
        toolCount?: number;
        active?: boolean;
      };

      // Only return active servers
      if (server.active === false) continue;

      mcpServers.push({
        id: serverDoc.id,
        name: server.name || serverDoc.id,
        description: server.description || "",
        endpoint: server.endpoint || "",
        tools: server.tools || [],
        toolCount: server.toolCount || (server.tools || []).length,
      });
    }

    return NextResponse.json({ mcpServers });
  } catch (error) {
    console.error("[User MCPs] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user MCPs" },
      { status: 500 }
    );
  }
}
