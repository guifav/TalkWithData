import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { verifyRequest } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";
import { canViewDashboardViaSharedFolder } from "@/lib/permissions";
import { deriveDashboardRefreshStatus } from "@/lib/dashboard-refresh-status";
import { startDashboardRefreshWorker } from "@/lib/dashboard-refresh-worker";
import type { AiRecipe } from "@/lib/types";

// Rate limit: max 1 refresh per dashboard per hour
export const MIN_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

type Auth = NonNullable<Awaited<ReturnType<typeof verifyRequest>>>;

type LoadDashboardResult =
  | { error: NextResponse }
  | {
      docRef: FirebaseFirestore.DocumentReference;
      dashData: FirebaseFirestore.DocumentData;
    };

async function loadAccessibleDashboard(
  id: string,
  auth: Auth
): Promise<LoadDashboardResult> {
  const docRef = adminDb.collection("dashboards").doc(id);
  const doc = await docRef.get();
  if (!doc.exists) {
    return { error: NextResponse.json({ error: "Dashboard not found" }, { status: 404 }) };
  }

  const dashData = doc.data()!;

  const isOwner = dashData.createdBy === auth.uid;
  const isTeam = dashData.visibility === "team";
  const isAllowedEmail =
    Array.isArray(dashData.allowedEmails) &&
    dashData.allowedEmails.includes(auth.email.toLowerCase());

  let canView = isOwner || isTeam || isAllowedEmail;

  if (
    !canView &&
    Array.isArray(dashData.allowedDepartments) &&
    dashData.allowedDepartments.length > 0
  ) {
    const deptSnap = await adminDb
      .collection("departments")
      .where("memberUids", "array-contains", auth.uid)
      .get();
    const userDeptIds = deptSnap.docs.map((d) => d.id);
    canView = dashData.allowedDepartments.some((deptId: string) =>
      userDeptIds.includes(deptId)
    );
  }

  if (!canView) {
    const folderAccess = await canViewDashboardViaSharedFolder(id, auth, adminDb);
    canView = folderAccess.allowed;
  }

  if (!canView) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { docRef, dashData };
}

function getRefreshStatusBody(dashData: FirebaseFirestore.DocumentData) {
  const aiRecipe = dashData.aiRecipe as AiRecipe | undefined;
  return deriveDashboardRefreshStatus({
    now: Date.now(),
    minRefreshIntervalMs: MIN_REFRESH_INTERVAL_MS,
    lastRefreshedAt: aiRecipe?.lastRefreshedAt,
    refreshLockedUntil: dashData.refreshLockedUntil as number | undefined,
    refreshJob: dashData.refreshJob,
  });
}

async function claimRefreshLock(
  docRef: FirebaseFirestore.DocumentReference,
  now: number
) {
  const lockExpiry = now + MIN_REFRESH_INTERVAL_MS;

  try {
    await adminDb.runTransaction(async (tx) => {
      const freshDoc = await tx.get(docRef);
      const freshData = freshDoc.data();

      const lockedUntil = freshData?.refreshLockedUntil as number | undefined;
      if (lockedUntil && lockedUntil > now) {
        throw new Error("IN_PROGRESS");
      }

      const freshRecipe = freshData?.aiRecipe as AiRecipe | undefined;
      const lastRefreshed = freshRecipe?.lastRefreshedAt
        ? new Date(freshRecipe.lastRefreshedAt).getTime()
        : 0;
      if (now - lastRefreshed < MIN_REFRESH_INTERVAL_MS) {
        throw new Error("RECENTLY_COMPLETED");
      }

      tx.update(docRef, { refreshLockedUntil: lockExpiry });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "IN_PROGRESS") {
      return "IN_PROGRESS" as const;
    }
    if (err instanceof Error && err.message === "RECENTLY_COMPLETED") {
      return "RECENTLY_COMPLETED" as const;
    }
    throw err;
  }

  return "CLAIMED" as const;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const loaded = await loadAccessibleDashboard(id, auth);
  if ("error" in loaded) return loaded.error;

  return NextResponse.json(getRefreshStatusBody(loaded.dashData));
}

/**
 * POST /api/dashboards/[id]/refresh
 *
 * Starts a background refresh job and returns immediately. The long-running
 * AI + MCP generation work is tracked in Firestore and exposed through GET.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  let claimedDocRef: FirebaseFirestore.DocumentReference | null = null;

  try {
    const loaded = await loadAccessibleDashboard(id, auth);
    if ("error" in loaded) return loaded.error;

    const { docRef, dashData } = loaded;
    const requesterDoc = await adminDb.collection("users").doc(auth.uid).get();
    const requesterRole = requesterDoc.data()?.role;
    const canMutate =
      dashData.createdBy === auth.uid ||
      requesterRole === "admin" ||
      requesterRole === "superadmin";
    if (!canMutate) {
      return NextResponse.json({ error: "Only the dashboard owner or an admin can refresh" }, { status: 403 });
    }

    const aiRecipe = dashData.aiRecipe as AiRecipe | undefined;

    if (dashData.source !== "ai") {
      return NextResponse.json(
        { error: "Only AI dashboards can be refreshed" },
        { status: 400 }
      );
    }

    if (!aiRecipe?.generationPrompt) {
      return NextResponse.json(
        { error: "Dashboard has no saved prompt to refresh from" },
        { status: 400 }
      );
    }

    const savedServerIds = [
      ...new Set(
        (aiRecipe.queries || [])
          .map((q) => q.mcpServerId)
          .filter((serverId): serverId is string => !!serverId)
      ),
    ];

    if (savedServerIds.length === 0) {
      return NextResponse.json(
        { error: "Dashboard has no saved MCP server references. Cannot refresh." },
        { status: 400 }
      );
    }

    const now = Date.now();
    const claim = await claimRefreshLock(docRef, now);
    if (claim === "IN_PROGRESS") {
      return NextResponse.json(
        { status: "in_progress", code: "IN_PROGRESS" },
        { status: 202 }
      );
    }
    if (claim === "RECENTLY_COMPLETED") {
      const freshDoc = await docRef.get();
      return NextResponse.json(
        getRefreshStatusBody(freshDoc.data() || dashData),
        { status: 200 }
      );
    }

    claimedDocRef = docRef;
    const startedAt = new Date(now).toISOString();
    await docRef.update({
      "refreshJob.status": "running",
      "refreshJob.startedAt": startedAt,
      "refreshJob.startedBy": auth.uid,
      "refreshJob.startedByEmail": auth.email,
      "refreshJob.error": FieldValue.delete(),
      "refreshJob.completedAt": FieldValue.delete(),
      "refreshJob.failedAt": FieldValue.delete(),
      "refreshJob.updatedAt": FieldValue.serverTimestamp(),
    });

    startDashboardRefreshWorker({ id, auth });

    return NextResponse.json(
      {
        status: "started",
        startedAt,
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("[Refresh] Start error:", error);
    if (claimedDocRef) {
      await claimedDocRef.update({
        refreshLockedUntil: 0,
        "refreshJob.status": "failed",
        "refreshJob.error": "Failed to start dashboard refresh",
        "refreshJob.failedAt": new Date().toISOString(),
        "refreshJob.updatedAt": FieldValue.serverTimestamp(),
      }).catch(() => {});
    }
    return NextResponse.json(
      { error: "Failed to start dashboard refresh" },
      { status: 500 }
    );
  }
}
