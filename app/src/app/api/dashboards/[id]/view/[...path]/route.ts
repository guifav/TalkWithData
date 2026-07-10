import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";
import { getDashboardAsset } from "@/lib/storage";
import { verifyEmbedToken } from "@/lib/embed-tokens";
import { prepareDashboardHtmlForRender } from "@/lib/dashboard-html";
import { verifyDashSessionToken, createDashSessionToken } from "@/lib/dash-session";
import {
  DASHBOARD_HTML_SECURITY_HEADERS,
  DASHBOARD_ASSET_SECURITY_HEADERS,
  isActiveDocumentContentType,
} from "@/lib/dashboard-security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Catch-all route for serving multi-page dashboard sub-path assets.
 *
 * URL pattern: /api/dashboards/{id}/view/{...path}
 *   e.g. /api/dashboards/abc123/view/assets/style.css
 *        /api/dashboards/abc123/view/pages/detail.html
 *
 * Authentication mirrors the main view route (Bearer token, cookie, or embed_token).
 * HTML files get the Chart.js compat shim; all other assets are served raw with
 * appropriate content types and caching headers.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  const { id, path: pathSegments } = await params;

  if (!pathSegments || pathSegments.length === 0) {
    return NextResponse.json({ error: "Path required" }, { status: 400 });
  }

  // Reconstruct relative path from catch-all segments
  const relativePath = pathSegments.join("/");

  // ── Auth ─────────────────────────────────────────────────────────────────
  // Sub-resources (CSS, JS, images, fonts) loaded by the browser from a dashboard
  // HTML page won't carry the embed_token query param. We allow them if:
  //   1. Standard auth (Bearer token or cookie), OR
  //   2. embed_token in query string, OR
  //   3. Session cookie set by the main view route (dash_session_{id})
  const auth = await verifyRequest(request);

  if (!auth) {
    const embedToken = request.nextUrl.searchParams.get("embed_token");
    let embedValid = false;

    if (embedToken) {
      embedValid = await verifyEmbedToken(id, embedToken);
    }

    if (!embedValid) {
      // Session cookie fallback: the main view route sets a short-lived httpOnly
      // cookie (10 min TTL) scoped to /api/dashboards/{id}/ when auth succeeds.
      // This allows sub-resource AND sub-page requests to authenticate without
      // embed_token on each URL. The short TTL limits post-logout exposure.
      const sessionCookie = request.cookies.get(`dash_session_${id}`)?.value;
      const sessionValid = sessionCookie
        ? verifyDashSessionToken(id, sessionCookie)
        : false;

      if (!sessionValid) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
  }

  try {
    // ── Fetch dashboard doc to get storage prefix ──────────────────────────
    const doc = await adminDb.collection("dashboards").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data = doc.data();
    if (!data?.storagePath) {
      return NextResponse.json({ error: "No file found" }, { status: 404 });
    }

    // ── Permission check (for authenticated users, not embed/session tokens) ──
    // dash_session cookies are already trusted (minted after main view route auth).
    // embed_token requests are already validated above.
    // Only standard auth (Bearer/cookie) needs the full sharing check.
    if (auth) {
      const isOwner = data.createdBy === auth.uid;
      const isTeam = data.visibility === "team";
      const isAllowedEmail =
        Array.isArray(data.allowedEmails) &&
        data.allowedEmails.includes(auth.email.toLowerCase());

      if (!isOwner && !isTeam && !isAllowedEmail) {
        let hasDeptAccess = false;
        if (
          Array.isArray(data.allowedDepartments) &&
          data.allowedDepartments.length > 0
        ) {
          const deptSnap = await adminDb
            .collection("departments")
            .where("memberUids", "array-contains", auth.uid)
            .get();
          const userDeptIds = deptSnap.docs.map((d) => d.id);
          hasDeptAccess = data.allowedDepartments.some((dId: string) =>
            userDeptIds.includes(dId)
          );
        }
        if (!hasDeptAccess) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }

    // Storage prefix is always dashboards/{uid}/{id}/ regardless of entrypoint depth.
    // Using createdBy + id avoids issues with nested entrypoints (e.g. pages/index.html)
    // where stripping the filename from storagePath would give the wrong prefix.
    const storagePrefix = `dashboards/${data.createdBy}/${id}/`;

    // ── Serve asset ────────────────────────────────────────────────────────
    const asset = await getDashboardAsset(storagePrefix, relativePath);
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Apply Chart.js compat shim to HTML files (sub-pages may also have charts)
    const isHtml = asset.contentType.startsWith("text/html");

    const contentType = isHtml
      ? "text/html; charset=utf-8"
      : asset.contentType;

    // Assets authenticate via cookie/embed token, so they are private, not
    // public: "public" would let a shared cache reuse an authenticated
    // response across viewers. Immutable per-upload, so the browser may still
    // cache. HTML pages get no-cache like the main view.
    const cacheControl = isHtml
      ? "private, no-store, no-cache, max-age=0, must-revalidate"
      : "private, max-age=86400, immutable";

    if (isHtml) {
      let html = prepareDashboardHtmlForRender(asset.buffer.toString("utf-8"));
      // Inject data API bootstrap for interactive multi-page apps
      const sessionToken = createDashSessionToken(id, "write");
      const bootstrap = {
        dashboardId: id,
        dataApi: `/api/dashboards/${id}/data`,
        dataToken: sessionToken,
      };
      const safeJson = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
      const dataApiScript = `<script>window.__TWD_DASHBOARD_ID__=${safeJson(bootstrap.dashboardId)};window.__TWD_DATA_API__=${safeJson(bootstrap.dataApi)};window.__TWD_DATA_TOKEN__=${safeJson(bootstrap.dataToken)};</script>`;
      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(/(<head[^>]*>)/i, `$1\n    ${dataApiScript}`);
      } else {
        html = `${dataApiScript}\n${html}`;
      }
      return new NextResponse(html, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": cacheControl,
          Pragma: "no-cache",
          Expires: "0",
          ...DASHBOARD_HTML_SECURITY_HEADERS,
        },
      });
    }

    // SVG and XML render as active documents on direct navigation, so they
    // need the same sandbox as HTML; inert assets get nosniff only.
    const assetSecurityHeaders = isActiveDocumentContentType(contentType)
      ? DASHBOARD_HTML_SECURITY_HEADERS
      : DASHBOARD_ASSET_SECURITY_HEADERS;

    return new NextResponse(asset.buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
        ...assetSecurityHeaders,
      },
    });
  } catch (error) {
    console.error(`Failed to serve dashboard asset: ${relativePath}`, error);
    return NextResponse.json(
      { error: "Failed to serve asset" },
      { status: 500 }
    );
  }
}
