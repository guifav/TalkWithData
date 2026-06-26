/**
 * GET /api/ai/db-context?dashboardId=<id>
 *
 * Returns the database context for a dashboard if one exists.
 * Used by the frontend to determine whether to enable database tools
 * and to pass `draftDashboardId` to the ai/chat route.
 *
 * Only the dashboard owner can access the database context.
 * Ownership is verified BOTH via Firestore doc AND via registry ownerUid
 * to prevent leaks when the Firestore doc is already deleted.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";
import { getInstanceWithTables, buildFirestoreSummary } from "@/lib/app-db/registry";

export async function GET(request: NextRequest) {
  const auth = await verifyRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dashboardId = request.nextUrl.searchParams.get("dashboardId");
  if (!dashboardId) {
    return NextResponse.json({ error: "dashboardId required" }, { status: 400 });
  }

  // Check Firestore doc ownership first
  const doc = await adminDb.collection("dashboards").doc(dashboardId).get();
  if (!doc.exists) {
    // If the dashboard doc doesn't exist, don't leak database metadata
    return NextResponse.json({ hasDatabase: false });
  }
  if (doc.data()?.createdBy !== auth.uid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const instance = await getInstanceWithTables(dashboardId);
  if (!instance || instance.status === "deleted" || instance.status === "orphaned") {
    return NextResponse.json({ hasDatabase: false });
  }

  // Double-check: registry ownerUid must match authenticated user
  if (instance.ownerUid !== auth.uid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    hasDatabase: true,
    ...buildFirestoreSummary(instance),
  });
}
