import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const dashboardsSnap = await adminDb.collection("dashboards").get();

    const dashboards = await Promise.all(
      dashboardsSnap.docs.map(async (doc) => {
        const data = doc.data();

        // Count unique viewers from views subcollection
        const viewsSnap = await adminDb
          .collection("dashboards")
          .doc(doc.id)
          .collection("views")
          .get();

        const uniqueViewers = new Set(
          viewsSnap.docs
            .map((v) => v.data().uid)
            .filter((uid) => uid && uid !== "embed")
        ).size;

        const embedViews = viewsSnap.docs.filter(
          (v) => v.data().source === "embed"
        ).length;

        return {
          id: doc.id,
          title: data.title || "Untitled",
          slug: data.slug || null,
          category: data.category || "Other",
          ownerEmail: data.createdByEmail || "Unknown",
          ownerName: data.createdByName || "Unknown",
          viewCount: data.viewCount || 0,
          uniqueViewers,
          embedViews,
          fileSizeBytes: data.fileSizeBytes || 0,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
          archivedAt: data.archivedAt?.toDate?.()?.toISOString() || null,
          visibility: data.visibility || "team",
          source: data.source || "upload",
          aiToolsUsed: data.source === "ai"
            ? (data.aiRecipe?.queries || []).map((q: { tool: string }) => q.tool)
            : [],
          lastRefreshedAt:
            data.source === "ai" && data.aiRecipe?.lastRefreshedAt
              ? data.aiRecipe.lastRefreshedAt
              : null,
        };
      })
    );

    // Sort by viewCount desc by default
    dashboards.sort((a, b) => b.viewCount - a.viewCount);

    return NextResponse.json({ dashboards });
  } catch (error) {
    console.error("Admin dashboards failed:", error);
    return NextResponse.json(
      { error: "Failed to load dashboards" },
      { status: 500 }
    );
  }
}
