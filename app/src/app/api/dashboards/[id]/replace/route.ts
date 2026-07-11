import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";
import {
  deleteDashboardFiles,
  deleteHtmlFile,
  uploadHtmlRevision,
  uploadZipDashboardRevision,
} from "@/lib/storage";
import { FieldValue } from "firebase-admin/firestore";
import { extractTextFromHtml, MAX_SEARCHABLE_TEXT } from "@/lib/html-text";
import { triggerThumbnailGeneration } from "@/lib/thumbnail";
import { archiveCurrentVersion } from "@/lib/versions";

const MAX_HTML_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ZIP_SIZE = 50 * 1024 * 1024; // 50MB

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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const entrypoint =
      (formData.get("entrypoint") as string) || "index.html";

    if (!file) {
      return NextResponse.json(
        { error: "File is required" },
        { status: 400 }
      );
    }

    const isZip = file.name.endsWith(".zip");
    const isHtml = file.name.endsWith(".html");

    if (!isZip && !isHtml) {
      return NextResponse.json(
        { error: "Only .html and .zip files are allowed" },
        { status: 400 }
      );
    }

    const maxSize = isZip ? MAX_ZIP_SIZE : MAX_HTML_SIZE;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File size exceeds ${maxSize / 1024 / 1024}MB limit` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wasMultiPage = !!data?.isMultiPage;

    if (isZip) {
      return await handleZipReplace({
        auth,
        id,
        data: data as Record<string, unknown>,
        buffer,
        entrypoint,
        wasMultiPage,
      });
    }

    // ── Single HTML replace ──

    // Archive current version BEFORE overwriting (single-file only)
    if (data?.storagePath && !wasMultiPage) {
      await archiveCurrentVersion(id, data as Record<string, unknown>, {
        uid: auth.uid,
        email: auth.email,
      });
    }

    const oldStoragePath = data?.storagePath;

    // Upload new file FIRST — old files stay intact until upload succeeds
    const storagePath = await uploadHtmlRevision(auth.uid, id, file.name, buffer);

    // Re-extract searchable text
    const htmlContent = buffer.toString("utf-8");
    const searchableText = extractTextFromHtml(htmlContent).slice(
      0,
      MAX_SEARCHABLE_TEXT
    );

    // Update Firestore — clear multi-page fields if replacing ZIP with HTML
    try {
      await adminDb
        .collection("dashboards")
        .doc(id)
        .update({
          fileName: file.name,
          fileSizeBytes: file.size,
          storagePath,
          searchableText,
          updatedAt: FieldValue.serverTimestamp(),
          // Clear multi-page fields when replacing with single HTML
          ...(wasMultiPage && {
            isMultiPage: FieldValue.delete(),
            storagePrefix: FieldValue.delete(),
            entrypoint: FieldValue.delete(),
            files: FieldValue.delete(),
          }),
        });
    } catch (error) {
      await deleteHtmlFile(storagePath).catch(() => {});
      throw error;
    }

    // Clean up old files AFTER Firestore update succeeds (safe ordering).
    if (wasMultiPage && Array.isArray(data!.files)) {
      await deleteOldPackage(data as Record<string, unknown>, auth.uid, id);
    } else if (oldStoragePath && oldStoragePath !== storagePath) {
      await deleteHtmlFile(oldStoragePath)
        .catch((err) => console.warn(`[Replace] Failed to delete old file:`, err));
    }

    // Fire-and-forget thumbnail generation
    triggerThumbnailGeneration(id);

    return NextResponse.json({ success: true, storagePath });
  } catch (error) {
    console.error("Failed to replace file:", error);
    return NextResponse.json(
      { error: "Failed to replace file" },
      { status: 500 }
    );
  }
}

// ── ZIP replace handler ─────────────────────────────────────────────────────

interface ZipReplaceParams {
  auth: { uid: string; email: string; name?: string };
  id: string;
  data: Record<string, unknown>;
  buffer: Buffer;
  entrypoint: string;
  wasMultiPage: boolean;
}

async function handleZipReplace({
  auth,
  id,
  data,
  buffer,
  entrypoint,
  wasMultiPage,
}: ZipReplaceParams) {
  // Upload into an immutable revision prefix. The new package is not visible
  // until Firestore atomically points at it, and a failed upload is cleaned up.
  let zipResult;
  try {
    zipResult = await uploadZipDashboardRevision(auth.uid, id, buffer, entrypoint);
  } catch (err) {
    // Upload failed — old files are still intact, dashboard still works
    const message =
      err instanceof Error ? err.message : "ZIP extraction failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Extract searchable text from entrypoint
  let searchableText = "";
  try {
    const { getHtmlFile } = await import("@/lib/storage");
    const entrypointBuffer = await getHtmlFile(zipResult.storagePath);
    searchableText = extractTextFromHtml(
      entrypointBuffer.toString("utf-8")
    ).slice(0, MAX_SEARCHABLE_TEXT);
  } catch {
    // Non-fatal
  }

  // Update Firestore with multi-page fields.
  try {
    await adminDb
      .collection("dashboards")
      .doc(id)
      .update({
        fileName: zipResult.entrypoint,
        fileSizeBytes: zipResult.totalSizeBytes,
        storagePath: zipResult.storagePath,
        storagePrefix: zipResult.storagePrefix,
        searchableText,
        updatedAt: FieldValue.serverTimestamp(),
        isMultiPage: true,
        entrypoint: zipResult.entrypoint,
        files: zipResult.files,
      });
  } catch (error) {
    await deleteDashboardFiles(zipResult.storagePrefix).catch(() => {});
    throw error;
  }

  // Clean up orphaned files AFTER Firestore update commits.
  // If this fails, we have stale files in storage (harmless) but the
  // dashboard is never left pointing at deleted content.
  if (wasMultiPage && Array.isArray(data.files)) {
    await deleteOldPackage(data, auth.uid, id);
  } else if (!wasMultiPage && data.storagePath) {
    await deleteHtmlFile(data.storagePath as string).catch(() => {});
  }

  triggerThumbnailGeneration(id);

  return NextResponse.json({
    success: true,
    storagePath: zipResult.storagePath,
    isMultiPage: true,
    entrypoint: zipResult.entrypoint,
    files: zipResult.files,
  });
}

async function deleteOldPackage(
  data: Record<string, unknown>,
  fallbackUserId: string,
  dashboardId: string
): Promise<void> {
  const legacyPrefix = `dashboards/${data.createdBy || fallbackUserId}/${dashboardId}/`;
  const oldPrefix =
    typeof data.storagePrefix === "string" ? data.storagePrefix : legacyPrefix;

  if (oldPrefix !== legacyPrefix) {
    await deleteDashboardFiles(oldPrefix).catch(() => {});
    return;
  }

  if (Array.isArray(data.files)) {
    await Promise.all(
      (data.files as string[]).map((file) =>
        deleteHtmlFile(`${oldPrefix}${file}`).catch(() => {})
      )
    );
  }
}
