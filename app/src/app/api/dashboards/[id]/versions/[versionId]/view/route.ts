import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";
import { getHtmlFile } from "@/lib/storage";
import { prepareDashboardHtmlForRender } from "@/lib/dashboard-html";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const auth = await verifyRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, versionId } = await params;

  try {
    const doc = await adminDb.collection("dashboards").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data = doc.data();
    if (data?.createdBy !== auth.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const versionDoc = await adminDb
      .collection("dashboards")
      .doc(id)
      .collection("versions")
      .doc(versionId)
      .get();

    if (!versionDoc.exists) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const vData = versionDoc.data()!;
    const buffer = await getHtmlFile(vData.storagePath);
    const html = prepareDashboardHtmlForRender(buffer.toString("utf-8"));

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("Failed to serve version:", error);
    return NextResponse.json(
      { error: "Failed to serve version" },
      { status: 500 }
    );
  }
}
