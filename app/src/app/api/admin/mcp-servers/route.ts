import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";
import { isAllowedMcpHost } from "@/lib/mcp-hosts";

const COLLECTION = "mcp_servers";

/**
 * GET /api/admin/mcp-servers
 * List all registered MCP servers (superadmin only).
 */
export async function GET(request: NextRequest) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const snap = await adminDb
      .collection(COLLECTION)
      .orderBy("name")
      .get();

    const servers = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ servers });
  } catch (error) {
    console.error("Failed to list MCP servers:", error);
    return NextResponse.json(
      { error: "Failed to list MCP servers" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/mcp-servers
 * Register a new MCP server (superadmin).
 * Body: { name, description, endpoint, requiredScope }
 */
export async function POST(request: NextRequest) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, description, endpoint, requiredScope } = body as {
      name?: string;
      description?: string;
      endpoint?: string;
      requiredScope?: string;
    };

    if (!name?.trim() || !endpoint?.trim() || !requiredScope?.trim()) {
      return NextResponse.json(
        { error: "Required: name, endpoint, requiredScope" },
        { status: 400 }
      );
    }

    if (!isAllowedMcpHost(endpoint.trim())) {
      return NextResponse.json(
        { error: "Endpoint host not in allowlist. Only your-mcp-server.com is permitted." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const docRef = adminDb.collection(COLLECTION).doc();
    const server = {
      id: docRef.id,
      name: name.trim(),
      description: (description || "").trim(),
      endpoint: endpoint.trim(),
      requiredScope: requiredScope.trim(),
      tools: [],
      toolCount: 0,
      lastSyncedAt: null,
      lastSyncError: null,
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(server);
    return NextResponse.json({ server }, { status: 201 });
  } catch (error) {
    console.error("Failed to create MCP server:", error);
    return NextResponse.json(
      { error: "Failed to create MCP server" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/mcp-servers
 * Update an MCP server (superadmin).
 * Body: { id, name?, description?, endpoint?, requiredScope?, active? }
 */
export async function PATCH(request: NextRequest) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, ...updates } = body as {
      id?: string;
      name?: string;
      description?: string;
      endpoint?: string;
      requiredScope?: string;
      active?: boolean;
    };

    if (!id) {
      return NextResponse.json({ error: "Required: id" }, { status: 400 });
    }

    const docRef = adminDb.collection(COLLECTION).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "MCP server not found" },
        { status: 404 }
      );
    }

    // Reject empty endpoint — it's mandatory
    if ("endpoint" in updates && !updates.endpoint?.trim()) {
      return NextResponse.json(
        { error: "endpoint cannot be empty" },
        { status: 400 }
      );
    }

    // Validate endpoint host if being changed
    if (updates.endpoint && !isAllowedMcpHost(updates.endpoint.trim())) {
      return NextResponse.json(
        { error: "Endpoint host not in allowlist. Only your-mcp-server.com is permitted." },
        { status: 400 }
      );
    }

    // Reject empty name — it's mandatory
    if ("name" in updates && !updates.name?.trim()) {
      return NextResponse.json(
        { error: "name cannot be empty" },
        { status: 400 }
      );
    }

    // Reject empty requiredScope — it's mandatory
    if ("requiredScope" in updates && !updates.requiredScope?.trim()) {
      return NextResponse.json(
        { error: "requiredScope cannot be empty" },
        { status: 400 }
      );
    }

    const allowedFields = ["name", "description", "endpoint", "requiredScope", "active"];
    const filtered: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const key of allowedFields) {
      if (key in updates && updates[key as keyof typeof updates] !== undefined) {
        const val = updates[key as keyof typeof updates];
        filtered[key] = typeof val === "string" ? val.trim() : val;
      }
    }

    // Invalidate stale tool metadata only when endpoint or scope actually changed
    const currentData = doc.data();
    const endpointChanged = updates.endpoint && updates.endpoint.trim() !== currentData?.endpoint;
    const scopeChanged = updates.requiredScope && updates.requiredScope.trim() !== currentData?.requiredScope;
    if (endpointChanged || scopeChanged) {
      filtered.tools = [];
      filtered.toolCount = 0;
      filtered.lastSyncedAt = null;
      filtered.lastSyncError = "Endpoint/scope changed — re-sync required";
    }

    await docRef.update(filtered);
    const updated = await docRef.get();
    return NextResponse.json({ server: { id: updated.id, ...updated.data() } });
  } catch (error) {
    console.error("Failed to update MCP server:", error);
    return NextResponse.json(
      { error: "Failed to update MCP server" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/mcp-servers
 * Remove an MCP server (superadmin).
 * Body: { id }
 */
export async function DELETE(request: NextRequest) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id } = body as { id?: string };

    if (!id) {
      return NextResponse.json({ error: "Required: id" }, { status: 400 });
    }

    const docRef = adminDb.collection(COLLECTION).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "MCP server not found" },
        { status: 404 }
      );
    }

    await docRef.delete();
    return NextResponse.json({ deleted: id });
  } catch (error) {
    console.error("Failed to delete MCP server:", error);
    return NextResponse.json(
      { error: "Failed to delete MCP server" },
      { status: 500 }
    );
  }
}
