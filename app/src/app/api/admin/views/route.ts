import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const daysParam = request.nextUrl.searchParams.get("days") || "30";
    const days = Math.min(parseInt(daysParam) || 30, 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const dashboardsSnap = await adminDb.collection("dashboards").get();

    // Collect all views across all dashboards
    const dailyDirect = new Map<string, number>();
    const dailyEmbed = new Map<string, number>();
    const embedByDashboard = new Map<string, { title: string; count: number }>();

    interface EmbedTokenInfo {
      dashboardId: string;
      dashboardTitle: string;
      createdByEmail: string;
      createdAt: string | null;
      expiresAt: string | null;
      isActive: boolean;
    }
    const embedTokensList: EmbedTokenInfo[] = [];

    for (const dashDoc of dashboardsSnap.docs) {
      const dashData = dashDoc.data();
      const dashTitle = dashData.title || "Untitled";

      // Views
      const viewsSnap = await adminDb
        .collection("dashboards")
        .doc(dashDoc.id)
        .collection("views")
        .where("viewedAt", ">=", since)
        .get();

      for (const vDoc of viewsSnap.docs) {
        const vData = vDoc.data();
        const viewedAt = vData.viewedAt?.toDate?.();
        if (!viewedAt) continue;

        const dateKey = viewedAt.toISOString().slice(0, 10);
        const isEmbed = vData.source === "embed";

        if (isEmbed) {
          dailyEmbed.set(dateKey, (dailyEmbed.get(dateKey) || 0) + 1);
          const existing = embedByDashboard.get(dashDoc.id);
          if (existing) {
            existing.count++;
          } else {
            embedByDashboard.set(dashDoc.id, { title: dashTitle, count: 1 });
          }
        } else {
          dailyDirect.set(dateKey, (dailyDirect.get(dateKey) || 0) + 1);
        }
      }

      // Embed tokens
      const tokensSnap = await adminDb
        .collection("dashboards")
        .doc(dashDoc.id)
        .collection("embedTokens")
        .get();

      for (const tDoc of tokensSnap.docs) {
        const tData = tDoc.data();
        const expiresAt = tData.expiresAt?.toDate?.()
          ? tData.expiresAt.toDate()
          : new Date(tData.expiresAt);

        embedTokensList.push({
          dashboardId: dashDoc.id,
          dashboardTitle: dashTitle,
          createdByEmail: tData.createdByEmail || "Unknown",
          createdAt: tData.createdAt?.toDate?.()?.toISOString() || null,
          expiresAt: expiresAt?.toISOString() || null,
          isActive: expiresAt > new Date(),
        });
      }
    }

    // Build time series (fill gaps with zeros)
    const timeSeries: { date: string; direct: number; embed: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      timeSeries.push({
        date: key,
        direct: dailyDirect.get(key) || 0,
        embed: dailyEmbed.get(key) || 0,
      });
    }

    // Top embedded dashboards
    const topEmbedded = Array.from(embedByDashboard.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return NextResponse.json({
      timeSeries,
      topEmbedded,
      embedTokens: embedTokensList,
    });
  } catch (error) {
    console.error("Admin views failed:", error);
    return NextResponse.json(
      { error: "Failed to load views" },
      { status: 500 }
    );
  }
}
