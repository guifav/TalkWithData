/**
 * POST /api/ai/provision-draft
 *
 * Reserves a stable dashboardId and creates a draft database scope
 * BEFORE the AI agent starts creating tables. This ensures that:
 *   1. The agent has a stable dashboardId to reference
 *   2. The database scope exists before the first write
 *   3. If the user abandons, the draft gets cleaned up (TTL 24h)
 *
 * The response includes the dashboardId, schema name, and table prefix
 * that the backend will use to scope all database tools.
 *
 * Only users with MCP access can provision drafts.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";
import { createDraftInstance } from "@/lib/app-db/registry";
import { ensureUserSchema } from "@/lib/app-db/schema-manager";
import { checkUserHasMcpAccess } from "@/lib/mcp-access";

export async function POST(request: NextRequest) {
  const auth = await verifyRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify user has MCP access
  const hasMcp = await checkUserHasMcpAccess(auth.uid);
  if (!hasMcp) {
    return NextResponse.json(
      { error: "MCP access required to create database apps" },
      { status: 403 }
    );
  }

  try {
    // Reserve a Firestore document ID as the stable dashboardId
    const docRef = adminDb.collection("dashboards").doc();
    const dashboardId = docRef.id;

    // Create draft instance in Postgres registry
    const instance = await createDraftInstance({
      dashboardId,
      ownerUid: auth.uid,
      ownerEmail: auth.email,
    });

    // Ensure the user's schema exists in Postgres
    await ensureUserSchema(instance.userSchema);

    return NextResponse.json({
      dashboardId,
      userSchema: instance.userSchema,
      tablePrefix: instance.tablePrefix,
      status: instance.status,
    });
  } catch (error) {
    console.error("[Provision Draft] Error:", error);
    return NextResponse.json(
      { error: "Failed to provision draft" },
      { status: 500 }
    );
  }
}


