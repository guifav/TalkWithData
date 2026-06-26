import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch all dashboards
    const dashboardsSnap = await adminDb.collection("dashboards").get();
    let totalActive = 0;
    let totalArchived = 0;
    let totalViews = 0;
    let totalStorageBytes = 0;

    for (const doc of dashboardsSnap.docs) {
      const data = doc.data();
      if (data.archivedAt) {
        totalArchived++;
      } else {
        totalActive++;
      }
      totalViews += data.viewCount || 0;
      totalStorageBytes += data.fileSizeBytes || 0;
    }

    // Fetch all users
    const usersSnap = await adminDb.collection("users").get();
    const totalUsers = usersSnap.size;
    let activeUsers7d = 0;
    let activeUsers30d = 0;

    for (const doc of usersSnap.docs) {
      const data = doc.data();
      const lastLogin = data.lastLoginAt?.toDate?.() || null;
      if (lastLogin) {
        if (lastLogin >= sevenDaysAgo) activeUsers7d++;
        if (lastLogin >= thirtyDaysAgo) activeUsers30d++;
      }
    }

    // Count views in last 7d and 30d by sampling view subcollections
    let views7d = 0;
    let views30d = 0;
    let embedTokensActive = 0;
    let embedTokensExpired = 0;

    for (const dashDoc of dashboardsSnap.docs) {
      // Views
      const viewsSnap = await adminDb
        .collection("dashboards")
        .doc(dashDoc.id)
        .collection("views")
        .where("viewedAt", ">=", thirtyDaysAgo)
        .get();

      for (const vDoc of viewsSnap.docs) {
        const viewedAt = vDoc.data().viewedAt?.toDate?.();
        if (viewedAt) {
          views30d++;
          if (viewedAt >= sevenDaysAgo) views7d++;
        }
      }

      // Embed tokens
      const tokensSnap = await adminDb
        .collection("dashboards")
        .doc(dashDoc.id)
        .collection("embedTokens")
        .get();

      for (const tDoc of tokensSnap.docs) {
        const expiresAt = tDoc.data().expiresAt?.toDate?.()
          || new Date(tDoc.data().expiresAt);
        if (expiresAt > now) {
          embedTokensActive++;
        } else {
          embedTokensExpired++;
        }
      }
    }

    return NextResponse.json({
      dashboards: {
        total: dashboardsSnap.size,
        active: totalActive,
        archived: totalArchived,
      },
      users: {
        total: totalUsers,
        active7d: activeUsers7d,
        active30d: activeUsers30d,
      },
      views: {
        total: totalViews,
        last7d: views7d,
        last30d: views30d,
      },
      storage: {
        totalBytes: totalStorageBytes,
      },
      embedTokens: {
        active: embedTokensActive,
        expired: embedTokensExpired,
      },
    });
  } catch (error) {
    console.error("Admin overview failed:", error);
    return NextResponse.json(
      { error: "Failed to load overview" },
      { status: 500 }
    );
  }
}
