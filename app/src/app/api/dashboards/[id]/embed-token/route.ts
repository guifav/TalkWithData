import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";
import { createEmbedToken } from "@/lib/embed-tokens";
import { canViewDashboard, canViewDashboardViaSharedFolder } from "@/lib/permissions";

/**
 * POST /api/dashboards/{id}/embed-token
 * Generate a tokenized embed URL for sharing in Notion/Slack iframes.
 * Any authenticated user with access to the dashboard can generate embed tokens.
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

  try {
    const doc = await adminDb.collection("dashboards").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data = doc.data();
    let userDepartmentIds: string[] = [];
    if (Array.isArray(data?.allowedDepartments) && data.allowedDepartments.length > 0) {
      const deptSnap = await adminDb
        .collection("departments")
        .where("memberUids", "array-contains", auth.uid)
        .get();
      userDepartmentIds = deptSnap.docs.map((d) => d.id);
    }

    const hasDirectAccess = canViewDashboard(
      {
        createdBy: typeof data?.createdBy === "string" ? data.createdBy : "",
        visibility: data?.visibility === "team" ? "team" : "specific",
        allowedEmails: Array.isArray(data?.allowedEmails) ? data.allowedEmails : [],
        allowedDepartments: Array.isArray(data?.allowedDepartments)
          ? data.allowedDepartments
          : [],
      },
      auth,
      userDepartmentIds
    );

    if (!hasDirectAccess) {
      const folderAccess = await canViewDashboardViaSharedFolder(id, auth, adminDb);
      if (!folderAccess.allowed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const token = await createEmbedToken(id, auth);

    // Build the embed URL using the public origin from headers (not nextUrl.origin,
    // which returns the internal Cloud Run host like 0.0.0.0:8080)
    const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
    const origin = forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
    const embedUrl = `${origin}/embed/${id}?token=${token}`;

    return NextResponse.json({ embedUrl, token, expiresIn: "7 days" });
  } catch (error) {
    console.error("Failed to create embed token:", error);
    return NextResponse.json(
      { error: "Failed to create embed token" },
      { status: 500 }
    );
  }
}
