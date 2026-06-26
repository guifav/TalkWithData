import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";
import { adminStorage } from "@/lib/firebase/admin";
import { archiveCurrentVersion } from "@/lib/versions";
import { extractTextFromHtml, MAX_SEARCHABLE_TEXT } from "@/lib/html-text";

const BUCKET_NAME = "example-uploads";

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
    // Only owner can view versions
    if (data?.createdBy !== auth.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const versionsSnap = await adminDb
      .collection("dashboards")
      .doc(id)
      .collection("versions")
      .orderBy("replacedAt", "desc")
      .get();

    const versions = versionsSnap.docs.map((v) => ({
      id: v.id,
      ...v.data(),
    }));

    return NextResponse.json({ versions });
  } catch (error) {
    console.error("Failed to list versions:", error);
    return NextResponse.json(
      { error: "Failed to list versions" },
      { status: 500 }
    );
  }
}

// POST: restore a specific version
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
    if (data?.createdBy !== auth.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { versionId } = body;
    if (!versionId) {
      return NextResponse.json(
        { error: "versionId is required" },
        { status: 400 }
      );
    }

    const versionDoc = await adminDb
      .collection("dashboards")
      .doc(id)
      .collection("versions")
      .doc(versionId)
      .get();

    if (!versionDoc.exists) {
      return NextResponse.json(
        { error: "Version not found" },
        { status: 404 }
      );
    }

    const vData = versionDoc.data()!;

    // Multi-page dashboards cannot be restored — versioning only archives
    // single HTML files, so restoring would produce an inconsistent state
    // (single HTML with stale isMultiPage/entrypoint/files metadata).
    if (data?.isMultiPage) {
      return NextResponse.json(
        { error: "Version restore is not supported for multi-page dashboards" },
        { status: 400 }
      );
    }

    const bucket = adminStorage.bucket(BUCKET_NAME);

    // Archive the current live file BEFORE restoring (so it's not lost)
    // Pass versionId as protectVersionId so FIFO cleanup won't delete
    // the version we're about to restore
    if (data?.storagePath) {
      await archiveCurrentVersion(
        id,
        data as Record<string, unknown>,
        { uid: auth.uid, email: auth.email },
        versionId
      );
    }

    // Copy version file to the primary dashboard path
    const restoredPath = `dashboards/${data?.createdBy}/${id}/${vData.fileName}`;
    await bucket.file(vData.storagePath).copy(bucket.file(restoredPath));

    // Re-extract searchable text from restored HTML
    const [restoredBuffer] = await bucket.file(restoredPath).download();
    const htmlContent = restoredBuffer.toString("utf-8");
    const searchableText = extractTextFromHtml(htmlContent).slice(
      0,
      MAX_SEARCHABLE_TEXT
    );

    // Update dashboard metadata
    const { FieldValue } = await import("firebase-admin/firestore");
    await adminDb.collection("dashboards").doc(id).update({
      fileName: vData.fileName,
      fileSizeBytes: vData.fileSizeBytes,
      storagePath: restoredPath,
      searchableText,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, restoredVersion: versionId });
  } catch (error) {
    console.error("Failed to restore version:", error);
    return NextResponse.json(
      { error: "Failed to restore version" },
      { status: 500 }
    );
  }
}
