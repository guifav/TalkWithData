import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";
import { uploadHtmlFile, deleteHtmlFile, uploadZipDashboard, deleteDashboardFiles } from "@/lib/storage";
import { FieldValue } from "firebase-admin/firestore";
import { generateSlug, reserveUniqueSlug, releaseSlug } from "@/lib/slug";
import { isValidCategory } from "@/lib/categories";
import { extractTextFromHtml, MAX_SEARCHABLE_TEXT } from "@/lib/html-text";
import { triggerThumbnailGeneration } from "@/lib/thumbnail";
import { isAllowedEmailDomain } from "@/lib/auth-domain";

const MAX_HTML_SIZE = 10 * 1024 * 1024; // 10MB for single HTML
const MAX_ZIP_SIZE = 50 * 1024 * 1024; // 50MB for ZIP packages

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  const cookieToken = request.cookies.get("app_auth")?.value;
  console.log(`[Upload] Auth header present: ${!!authHeader}, cookie present: ${!!cookieToken}, header prefix: ${authHeader?.slice(0, 15)}`);

  const auth = await verifyRequest(request);
  if (!auth) {
    console.log("[Upload] verifyRequest returned null — token invalid or missing");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;
    const description = (formData.get("description") as string) || null;
    const visibility =
      (formData.get("visibility") as "team" | "specific") || "team";
    const categoryRaw = (formData.get("category") as string) || "Other";
    const category = (await isValidCategory(categoryRaw)) ? categoryRaw : "Other";
    const allowedEmailsRaw =
      (formData.get("allowedEmails") as string) || "";
    const entrypoint = (formData.get("entrypoint") as string) || "index.html";

    if (!file || !title?.trim()) {
      return NextResponse.json(
        { error: "File and title are required" },
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

    const allowedEmails =
      visibility === "specific"
        ? allowedEmailsRaw
            .split(/[\n,]/)
            .map((e) => e.trim().toLowerCase())
            .filter(isAllowedEmailDomain)
        : [];

    // Allocate doc ID upfront (no write yet)
    const docRef = adminDb.collection("dashboards").doc();
    const dashboardId = docRef.id;
    const buffer = Buffer.from(await file.arrayBuffer());

    if (isZip) {
      return await handleZipUpload({
        auth, docRef, dashboardId, buffer, title: title.trim(),
        description, category, visibility, allowedEmails, entrypoint,
      });
    }

    // ── Single HTML upload (existing flow) ──
    const htmlContent = buffer.toString("utf-8");
    const searchableText = extractTextFromHtml(htmlContent).slice(0, MAX_SEARCHABLE_TEXT);

    // Phase 1: Upload file to GCS
    const storagePath = await uploadHtmlFile(auth.uid, dashboardId, file.name, buffer);

    // Phase 2: Reserve slug
    let slug: string | undefined;
    try {
      slug = await reserveUniqueSlug(generateSlug(title.trim()), dashboardId);
    } catch (err) {
      await deleteHtmlFile(storagePath).catch(() => {});
      throw err;
    }

    // Phase 3: Create Firestore doc (if this fails, rollback file + slug)
    try {
      await docRef.set({
        slug,
        title: title.trim(),
        description: description?.trim() || null,
        fileName: file.name,
        storagePath,
        fileSizeBytes: file.size,
        thumbnailUrl: null,
        thumbnailUpdatedAt: null,
        thumbnailStoragePath: null,
        thumbnailContentType: null,
        category,
        visibility,
        allowedEmails,
        createdBy: auth.uid,
        createdByEmail: auth.email,
        createdByName: auth.name || auth.email,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        viewCount: 0,
        lastViewedAt: null,
        archivedAt: null,
        archivedBy: null,
        searchableText,
      });
    } catch (err) {
      await releaseSlug(slug!).catch(() => {});
      await deleteHtmlFile(storagePath).catch(() => {});
      throw err;
    }

    triggerThumbnailGeneration(dashboardId);
    return NextResponse.json({ id: dashboardId, storagePath });

  } catch (error) {
    console.error("Upload failed:", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── ZIP upload handler ──────────────────────────────────────────────────────

interface ZipUploadParams {
  auth: { uid: string; email: string; name?: string };
  docRef: FirebaseFirestore.DocumentReference;
  dashboardId: string;
  buffer: Buffer;
  title: string;
  description: string | null;
  category: string;
  visibility: "team" | "specific";
  allowedEmails: string[];
  entrypoint: string;
}

async function handleZipUpload({
  auth, docRef, dashboardId, buffer, title,
  description, category, visibility, allowedEmails, entrypoint,
}: ZipUploadParams) {
  // Phase 1: Extract and upload ZIP to GCS
  let zipResult;
  try {
    zipResult = await uploadZipDashboard(auth.uid, dashboardId, buffer, entrypoint);
  } catch (err) {
    // Clean up any partially uploaded files
    const partialPrefix = `dashboards/${auth.uid}/${dashboardId}/`;
    await deleteDashboardFiles(partialPrefix).catch(() => {});
    const message = err instanceof Error ? err.message : "ZIP extraction failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Extract searchable text from the entrypoint HTML
  let searchableText = "";
  try {
    const { getHtmlFile } = await import("@/lib/storage");
    const entrypointBuffer = await getHtmlFile(zipResult.storagePath);
    const { extractTextFromHtml, MAX_SEARCHABLE_TEXT } = await import("@/lib/html-text");
    searchableText = extractTextFromHtml(entrypointBuffer.toString("utf-8")).slice(0, MAX_SEARCHABLE_TEXT);
  } catch {
    // Non-fatal: some ZIPs may not have extractable text
  }

  // Phase 2: Reserve slug
  let slug: string | undefined;
  try {
    const { generateSlug, reserveUniqueSlug } = await import("@/lib/slug");
    slug = await reserveUniqueSlug(generateSlug(title), dashboardId);
  } catch (err) {
    await deleteDashboardFiles(zipResult.storagePrefix).catch(() => {});
    throw err;
  }

  // Phase 3: Create Firestore doc
  try {
    await docRef.set({
      slug,
      title,
      description: description?.trim() || null,
      fileName: zipResult.entrypoint,
      storagePath: zipResult.storagePath,
      fileSizeBytes: zipResult.totalSizeBytes,
      thumbnailUrl: null,
      thumbnailUpdatedAt: null,
      thumbnailStoragePath: null,
      thumbnailContentType: null,
      category,
      visibility,
      allowedEmails,
      createdBy: auth.uid,
      createdByEmail: auth.email,
      createdByName: auth.name || auth.email,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      viewCount: 0,
      lastViewedAt: null,
      archivedAt: null,
      archivedBy: null,
      searchableText,
      // Multi-page fields
      isMultiPage: true,
      entrypoint: zipResult.entrypoint,
      files: zipResult.files,
    });
  } catch (err) {
    const { releaseSlug } = await import("@/lib/slug");
    await releaseSlug(slug!).catch(() => {});
    await deleteDashboardFiles(zipResult.storagePrefix).catch(() => {});
    throw err;
  }

  triggerThumbnailGeneration(dashboardId);

  return NextResponse.json({
    id: dashboardId,
    storagePath: zipResult.storagePath,
    isMultiPage: true,
    entrypoint: zipResult.entrypoint,
    files: zipResult.files,
  });
}
