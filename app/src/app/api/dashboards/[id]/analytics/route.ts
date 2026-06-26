import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const doc = await adminDb.collection("dashboards").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data = doc.data();
    if (data?.createdBy !== auth.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch ALL view events (paginated to avoid memory issues)
    const viewsCollection = adminDb
      .collection("dashboards")
      .doc(id)
      .collection("views");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const views: any[] = [];
    const PAGE_SIZE = 500;
    let startAfterDoc: unknown = null;

    for (;;) {
      let q = viewsCollection.orderBy("viewedAt", "desc").limit(PAGE_SIZE);
      if (startAfterDoc) {
        q = q.startAfter(startAfterDoc);
      }
      const snap = await q.get();
      for (const d of snap.docs) {
        views.push(d.data());
      }
      if (snap.size < PAGE_SIZE) break;
      startAfterDoc = snap.docs[snap.docs.length - 1];
    }

    // Compute metrics
    const totalViews = views.length;
    const uniqueViewers = new Set(views.map((v) => v.uid)).size;

    // Daily counts for last 30 days
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const dailyCounts: Record<string, number> = {};

    // Initialize all 30 days
    for (let i = 0; i < 30; i++) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      dailyCounts[key] = 0;
    }

    for (const v of views) {
      const ts = v.viewedAt?._seconds
        ? v.viewedAt._seconds * 1000
        : typeof v.viewedAt?.toMillis === "function"
          ? v.viewedAt.toMillis()
          : 0;
      if (ts < thirtyDaysAgo) continue;
      const key = new Date(ts).toISOString().slice(0, 10);
      if (key in dailyCounts) dailyCounts[key]++;
    }

    // Sort daily counts by date
    const daily = Object.entries(dailyCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    // Viewer list (unique, most recent first)
    const viewerMap = new Map<
      string,
      { uid: string; email: string; displayName: string; lastAccess: number; viewCount: number }
    >();
    for (const v of views) {
      const existing = viewerMap.get(v.uid);
      const ts = v.viewedAt?._seconds
        ? v.viewedAt._seconds * 1000
        : typeof v.viewedAt?.toMillis === "function"
          ? v.viewedAt.toMillis()
          : 0;
      if (!existing) {
        viewerMap.set(v.uid, {
          uid: v.uid,
          email: v.email,
          displayName: v.displayName || v.email,
          lastAccess: ts,
          viewCount: 1,
        });
      } else {
        existing.viewCount++;
        if (ts > existing.lastAccess) existing.lastAccess = ts;
      }
    }

    const viewers = Array.from(viewerMap.values()).sort(
      (a, b) => b.lastAccess - a.lastAccess
    );

    // Views this week
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const viewsThisWeek = views.filter((v) => {
      const ts = v.viewedAt?._seconds
        ? v.viewedAt._seconds * 1000
        : 0;
      return ts > weekAgo;
    }).length;

    return NextResponse.json({
      totalViews,
      uniqueViewers,
      viewsThisWeek,
      daily,
      viewers,
    });
  } catch (error) {
    console.error("Failed to get analytics:", error);
    return NextResponse.json(
      { error: "Failed to get analytics" },
      { status: 500 }
    );
  }
}
