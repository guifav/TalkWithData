import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";

/**
 * GET — List all MCP access assignments (superadmin only).
 * For each, resolves department names and user emails for display.
 */
export async function GET(request: NextRequest) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const accessSnap = await adminDb.collection("mcp_access").get();

    // Batch-resolve department names
    const deptIds = new Set<string>();
    const userUids = new Set<string>();

    const accessDocs = accessSnap.docs.map((doc) => {
      const data = doc.data() as {
        assignedDepartments?: string[];
        assignedUsers?: string[];
        updatedAt?: string;
        updatedBy?: string;
      };
      (data.assignedDepartments || []).forEach((id: string) => deptIds.add(id));
      (data.assignedUsers || []).forEach((uid: string) => userUids.add(uid));
      return { mcpServerId: doc.id, ...data };
    });

    // Resolve department names
    const deptMap: Record<string, string> = {};
    if (deptIds.size > 0) {
      const deptSnap = await adminDb.collection("departments").get();
      deptSnap.docs.forEach((d) => {
        if (deptIds.has(d.id)) {
          deptMap[d.id] = d.data().name || d.id;
        }
      });
    }

    // Resolve user emails
    const userMap: Record<string, string> = {};
    if (userUids.size > 0) {
      const userSnap = await adminDb.collection("users").get();
      userSnap.docs.forEach((u) => {
        if (userUids.has(u.id)) {
          userMap[u.id] = u.data().email || u.id;
        }
      });
    }

    // Try to get MCP server names
    const serverMap: Record<string, string> = {};
    try {
      const serversSnap = await adminDb.collection("mcp_servers").get();
      serversSnap.docs.forEach((s) => {
        serverMap[s.id] = s.data().name || s.id;
      });
    } catch {
      // mcp_servers collection may not exist yet
    }

    const items = accessDocs.map((doc) => ({
      mcpServerId: doc.mcpServerId,
      mcpServerName: serverMap[doc.mcpServerId] || doc.mcpServerId,
      assignedDepartments: (doc.assignedDepartments || []).map((id: string) => ({
        id,
        name: deptMap[id] || id,
      })),
      assignedUsers: (doc.assignedUsers || []).map((uid: string) => ({
        uid,
        email: userMap[uid] || uid,
      })),
      updatedAt: doc.updatedAt || null,
      updatedBy: doc.updatedBy || null,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("[MCP Access GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch MCP access" },
      { status: 500 }
    );
  }
}

/**
 * POST — Update access for an MCP server (superadmin only).
 */
export async function POST(request: NextRequest) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { mcpServerId, assignedDepartments, assignedUsers } = body as {
      mcpServerId: string;
      assignedDepartments?: string[];
      assignedUsers?: string[];
    };

    if (!mcpServerId) {
      return NextResponse.json(
        { error: "mcpServerId is required" },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection("mcp_access").doc(mcpServerId);
    const updateData: Record<string, unknown> = {
      mcpServerId,
      updatedAt: new Date().toISOString(),
      updatedBy: auth.email,
    };

    if (assignedDepartments !== undefined) {
      updateData.assignedDepartments = assignedDepartments;
    }
    if (assignedUsers !== undefined) {
      updateData.assignedUsers = assignedUsers;
    }

    await docRef.set(updateData, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[MCP Access POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to update MCP access" },
      { status: 500 }
    );
  }
}
