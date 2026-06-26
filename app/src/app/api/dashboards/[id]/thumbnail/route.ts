import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { canViewDashboardViaSharedFolder } from "@/lib/permissions";

const BUCKET_NAME = "gri-dashs-uploads";
const THUMBNAIL_PREFIX = "thumbnails/";
const MAX_SIZE = 1024 * 1024; // 1MB max

type DashboardThumbnailDoc = {
  allowedEmails?: string[];
  allowedDepartments?: string[];
  createdBy?: string;
  thumbnailContentType?: string | null;
  thumbnailStoragePath?: string | null;
  visibility?: "team" | "specific";
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getUserDepartmentIds(uid: string): Promise<string[]> {
  const snap = await adminDb
    .collection("departments")
    .where("memberUids", "array-contains", uid)
    .get();
  return snap.docs.map((doc) => doc.id);
}

function canViewDashboardSync(
  dashData: DashboardThumbnailDoc | undefined,
  auth: { uid: string; email: string },
  userDepartmentIds: string[] = []
): boolean {
  if (!dashData) return false;
  if (dashData.createdBy === auth.uid) return true;
  if (dashData.visibility === "team") return true;
  if (
    Array.isArray(dashData.allowedEmails) &&
    dashData.allowedEmails.includes(auth.email.toLowerCase())
  ) {
    return true;
  }
  if (
    Array.isArray(dashData.allowedDepartments) &&
    dashData.allowedDepartments.length > 0 &&
    userDepartmentIds.length > 0
  ) {
    return dashData.allowedDepartments.some((deptId) =>
      userDepartmentIds.includes(deptId)
    );
  }
  return false;
}

function getThumbnailUrl(id: string): string {
  return `/api/dashboards/${id}/thumbnail`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const dashDoc = await adminDb.collection("dashboards").doc(id).get();
    if (!dashDoc.exists) {
      return NextResponse.json({ error: "Dashboard not found" }, { status: 404 });
    }

    const dashData = dashDoc.data() as DashboardThumbnailDoc | undefined;

    // Check basic access first, then department access if needed
    const hasBasicAccess =
      dashData?.createdBy === auth.uid ||
      dashData?.visibility === "team" ||
      (Array.isArray(dashData?.allowedEmails) &&
        dashData!.allowedEmails!.includes(auth.email.toLowerCase()));

    let userDeptIds: string[] = [];
    if (!hasBasicAccess && dashData?.allowedDepartments?.length) {
      userDeptIds = await getUserDepartmentIds(auth.uid);
    }

    if (!canViewDashboardSync(dashData, auth, userDeptIds)) {
      // Check shared folder inheritance (lazy — only when direct access fails)
      const folderAccess = await canViewDashboardViaSharedFolder(id, auth, adminDb);
      if (!folderAccess.allowed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (!dashData?.thumbnailStoragePath) {
      return NextResponse.json({ error: "Thumbnail not found" }, { status: 404 });
    }

    const bucket = adminStorage.bucket(BUCKET_NAME);
    const [buffer] = await bucket.file(dashData.thumbnailStoragePath).download();

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": dashData.thumbnailContentType || "image/webp",
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Thumbnail serve failed:", error);
    return NextResponse.json({ error: "Thumbnail serve failed" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    // Verify dashboard exists and caller has write permission
    const dashDoc = await adminDb.collection("dashboards").doc(id).get();
    if (!dashDoc.exists) {
      return NextResponse.json({ error: "Dashboard not found" }, { status: 404 });
    }
    const dashData = dashDoc.data();
    if (dashData?.createdBy !== auth.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { thumbnail } = body as { thumbnail: string };

    if (!thumbnail) {
      return NextResponse.json({ error: "Missing thumbnail data" }, { status: 400 });
    }

    // Expect base64 data URL: data:image/png;base64,...
    const match = thumbnail.match(/^data:image\/(png|jpeg|webp);base64,(.+)$/);
    if (!match) {
      return NextResponse.json({ error: "Invalid thumbnail format" }, { status: 400 });
    }

    const extension = match[1] === "jpeg" ? "jpg" : match[1];
    const mimeType = extension === "jpg" ? "image/jpeg" : `image/${extension}`;
    const buffer = Buffer.from(match[2], "base64");

    if (buffer.length > MAX_SIZE) {
      return NextResponse.json({ error: "Thumbnail too large" }, { status: 400 });
    }

    const bucket = adminStorage.bucket(BUCKET_NAME);
    const timestamp = Date.now();
    const newPath = `${THUMBNAIL_PREFIX}${id}_${timestamp}.${extension}`;
    const newFile = bucket.file(newPath);

    // Capture the old storage path BEFORE updating anything
    const oldStoragePath = dashData?.thumbnailStoragePath as string | null | undefined;

    // 1. Write to a versioned path — old thumbnail remains untouched
    await newFile.save(buffer, {
      contentType: mimeType,
      metadata: { cacheControl: "private, max-age=31536000, immutable" },
    });

    // 2. Update Firestore to point to the new path
    const thumbnailUrl = getThumbnailUrl(id);
    await adminDb.collection("dashboards").doc(id).update({
      thumbnailUrl,
      thumbnailStoragePath: newPath,
      thumbnailContentType: mimeType,
      thumbnailUpdatedAt: new Date().toISOString(),
    });

    // 3. Firestore committed — clean up the PREVIOUS blob + legacy fixed-name variants.
    //    Best-effort: orphaned files are harmless.
    const pathsToDelete = new Set(
      ["png", "jpg", "webp"].map((ext) => `${THUMBNAIL_PREFIX}${id}.${ext}`)
    );
    if (oldStoragePath && oldStoragePath !== newPath) {
      pathsToDelete.add(oldStoragePath);
    }
    void Promise.allSettled(
      [...pathsToDelete].map((p) =>
        bucket.file(p).delete({ ignoreNotFound: true })
      )
    );

    return NextResponse.json({ thumbnailUrl });
  } catch (error) {
    console.error("Thumbnail upload failed:", error);
    return NextResponse.json({ error: "Thumbnail upload failed" }, { status: 500 });
  }
}
