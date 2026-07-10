/**
 * POST /api/ai/cleanup-drafts
 *
 * Cleans up orphaned draft database instances older than 24 hours.
 * Should be called periodically (cron job) or manually by admin.
 *
 * Steps:
 *   1. Find draft instances older than 24h
 *   2. Drop their tables from Postgres
 *   3. Mark them as "orphaned" in the registry
 *
 * Protected: superadmin only, or internal (via shared secret).
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/api-auth";
import { findOrphanedDrafts, markOrphaned } from "@/lib/app-db/registry";
import { dropTablesWithPrefix } from "@/lib/app-db/schema-manager";

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function POST(request: NextRequest) {
  // Auth: superadmin or internal secret
  const internalSecret = request.headers.get("x-internal-secret");
  const expectedSecret = process.env.DASHBOARD_SESSION_SECRET;

  if (internalSecret && expectedSecret && internalSecret === expectedSecret) {
    // OK — internal call
  } else {
    const auth = await verifySuperAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const drafts = await findOrphanedDrafts(DRAFT_TTL_MS);

    if (drafts.length === 0) {
      return NextResponse.json({ cleaned: 0, message: "No orphaned drafts found" });
    }

    const results: Array<{ dashboardId: string; tablesDropped: string[]; success: boolean }> = [];
    const successIds: string[] = [];

    for (const draft of drafts) {
      try {
        const dropped = await dropTablesWithPrefix(draft.userSchema, draft.tablePrefix);
        results.push({ dashboardId: draft.dashboardId, tablesDropped: dropped, success: true });
        successIds.push(draft.id);
      } catch (err) {
        console.error(`[Cleanup] Failed to drop tables for ${draft.dashboardId}:`, err);
        results.push({ dashboardId: draft.dashboardId, tablesDropped: [], success: false });
        // Don't mark as orphaned — leave in draft so next run retries
      }
    }

    // Only mark successfully cleaned instances as orphaned
    await markOrphaned(successIds);

    return NextResponse.json({
      cleaned: drafts.length,
      results,
    });
  } catch (error) {
    console.error("[Cleanup Drafts] Error:", error);
    return NextResponse.json(
      { error: "Failed to clean up drafts" },
      { status: 500 }
    );
  }
}
