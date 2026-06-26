import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";
import { canViewDashboardViaSharedFolder } from "@/lib/permissions";
import { getHtmlFile } from "@/lib/storage";
import { FieldValue } from "firebase-admin/firestore";
import { verifyEmbedToken } from "@/lib/embed-tokens";
import { prepareDashboardHtmlForRender } from "@/lib/dashboard-html";
import { createDashSessionToken } from "@/lib/dash-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Try standard auth first (Bearer token or cookie)
  const auth = await verifyRequest(request);

  // If no standard auth, try embed token from query string
  if (!auth) {
    const embedToken = request.nextUrl.searchParams.get("embed_token");
    if (!embedToken || !(await verifyEmbedToken(id, embedToken))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // embed token valid — proceed without user context
  }

  try {
    const doc = await adminDb.collection("dashboards").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data = doc.data();
    if (!data?.storagePath) {
      return NextResponse.json({ error: "No file found" }, { status: 404 });
    }

    // Permission check for authenticated users (embed tokens already validated above)
    if (auth) {
      const dashData = data;
      const isOwner = dashData.createdBy === auth.uid;
      const isTeam = dashData.visibility === "team";
      const isAllowedEmail =
        Array.isArray(dashData.allowedEmails) &&
        dashData.allowedEmails.includes(auth.email.toLowerCase());

      if (!isOwner && !isTeam && !isAllowedEmail) {
        // Check department access only if needed
        let hasDeptAccess = false;
        if (
          Array.isArray(dashData.allowedDepartments) &&
          dashData.allowedDepartments.length > 0
        ) {
          const deptSnap = await adminDb
            .collection("departments")
            .where("memberUids", "array-contains", auth.uid)
            .get();
          const userDeptIds = deptSnap.docs.map((d) => d.id);
          hasDeptAccess = dashData.allowedDepartments.some((id: string) =>
            userDeptIds.includes(id)
          );
        }
        if (!hasDeptAccess) {
          // Check shared folder inheritance (lazy — only when direct access fails)
          const folderAccess = await canViewDashboardViaSharedFolder(id, auth, adminDb);
          if (!folderAccess.allowed) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
          }
        }
      }
    }

    // Skip analytics tracking when raw=1 (used by AI editor to load HTML without side effects)
    const isRaw = request.nextUrl.searchParams.get("raw") === "1";

    if (isRaw) {
      // raw=1: AI editor loading HTML — no analytics side effects
    } else if (auth) {
      // Authenticated view: track analytics
      adminDb
        .collection("dashboards")
        .doc(id)
        .update({
          viewCount: FieldValue.increment(1),
          lastViewedAt: FieldValue.serverTimestamp(),
        })
        .catch(() => {});

      adminDb
        .collection("users")
        .doc(auth.uid)
        .collection("viewed")
        .doc(id)
        .set(
          { dashboardId: id, lastViewedAt: FieldValue.serverTimestamp() },
          { merge: true }
        )
        .catch(() => {});

      adminDb
        .collection("dashboards")
        .doc(id)
        .collection("views")
        .add({
          uid: auth.uid,
          email: auth.email,
          displayName: auth.name || auth.email,
          viewedAt: FieldValue.serverTimestamp(),
          source: "direct",
        })
        .catch(() => {});
    } else {
      // Embed: no client-side tracking, so increment viewCount and record event here.
      adminDb
        .collection("dashboards")
        .doc(id)
        .update({ viewCount: FieldValue.increment(1) })
        .catch(() => {});

      adminDb
        .collection("dashboards")
        .doc(id)
        .collection("views")
        .add({
          uid: "embed",
          email: "embed",
          displayName: "Embed viewer",
          viewedAt: FieldValue.serverTimestamp(),
          source: "embed",
        })
        .catch(() => {});
    }

    const buffer = await getHtmlFile(data.storagePath);
    // raw=1 serves original HTML (used by AI editor to load/save without shim injection).
    // Normal views get the compat shim for legacy Chart.js dashboards.
    let html = isRaw
      ? buffer.toString("utf-8")
      : prepareDashboardHtmlForRender(buffer.toString("utf-8"));

    // For multi-page dashboards, inject a <base> tag so relative links (CSS, JS,
    // images) resolve through the catch-all sub-path route.
    // e.g., <link href="assets/style.css"> → /api/dashboards/{id}/view/assets/style.css
    if (data.isMultiPage && !isRaw) {
      const entryDir = (data.entrypoint || "index.html").replace(/[^\/]+$/, "");
      const baseHref = `/api/dashboards/${id}/view/${entryDir}`;
      const baseTag = `<base href="${baseHref}">`;

      // Inject <base> right after <head> (or at the start if no <head> tag)
      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(/(<head[^>]*>)/i, `$1\n    ${baseTag}`);
      } else {
        html = `${baseTag}\n${html}`;
      }
    }

    // Inject dashboard ID, data API base URL, and session token for runtime data access
    // Skip for raw=1 (editor loads pristine HTML to avoid persisting server injections)
    if (!isRaw) {
      const sessionToken = createDashSessionToken(id);
      const dataApiScript = `<script>window.__TWD_DASHBOARD_ID__="${id}";window.__TWD_DATA_API__="/api/dashboards/${id}/data";window.__TWD_DATA_TOKEN__="${sessionToken}";</script>`;
      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(/(<head[^>]*>)/i, `$1\n    ${dataApiScript}`);
      } else {
        html = `${dataApiScript}\n${html}`;
      }
    }

    // Build response with session cookie for sub-resource auth
    const response = new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });

    // Set session cookie so sub-resource requests (CSS, JS, images) from this
    // dashboard are authenticated without needing embed_token on each URL.
    const cookieName = `dash_session_${id}`;
    const cookieValue = createDashSessionToken(id);
    response.cookies.set(cookieName, cookieValue, {
      httpOnly: true,
      secure: true, // Required for SameSite=None
      sameSite: "none", // Allow cookie in cross-site iframes (embed mode)
      path: `/api/dashboards/${id}/`,
      maxAge: 600, // 10 minutes — short to limit post-logout exposure
    });

    return response;
  } catch (error) {
    console.error("Failed to serve dashboard:", error);
    return NextResponse.json(
      { error: "Failed to serve dashboard" },
      { status: 500 }
    );
  }
}
