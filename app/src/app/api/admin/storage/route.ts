import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const dashboardsSnap = await adminDb.collection("dashboards").get();

    // Storage by user
    const storageByUser = new Map<
      string,
      { email: string; bytes: number; count: number }
    >();

    // Storage by category
    const storageByCategory = new Map<string, number>();

    // Large files
    const largeFiles: {
      id: string;
      title: string;
      ownerEmail: string;
      fileSizeBytes: number;
      fileName: string;
    }[] = [];

    let totalVersionBytes = 0;
    let totalVersionCount = 0;

    for (const doc of dashboardsSnap.docs) {
      const data = doc.data();
      const bytes = data.fileSizeBytes || 0;
      const email = data.createdByEmail || "Unknown";
      const uid = data.createdBy || "unknown";
      const category = data.category || "Other";

      // By user
      const existing = storageByUser.get(uid);
      if (existing) {
        existing.bytes += bytes;
        existing.count++;
      } else {
        storageByUser.set(uid, { email, bytes, count: 1 });
      }

      // By category
      storageByCategory.set(
        category,
        (storageByCategory.get(category) || 0) + bytes
      );

      // Large files (>5MB)
      if (bytes > 5 * 1024 * 1024) {
        largeFiles.push({
          id: doc.id,
          title: data.title || "Untitled",
          ownerEmail: email,
          fileSizeBytes: bytes,
          fileName: data.fileName || "unknown",
        });
      }

      // Version storage
      const versionsSnap = await adminDb
        .collection("dashboards")
        .doc(doc.id)
        .collection("versions")
        .get();

      for (const vDoc of versionsSnap.docs) {
        totalVersionBytes += vDoc.data().fileSizeBytes || 0;
        totalVersionCount++;
      }
    }

    // Format results
    const byUser = Array.from(storageByUser.entries())
      .map(([uid, data]) => ({ uid, ...data }))
      .sort((a, b) => b.bytes - a.bytes);

    const byCategory = Array.from(storageByCategory.entries())
      .map(([category, bytes]) => ({ category, bytes }))
      .sort((a, b) => b.bytes - a.bytes);

    largeFiles.sort((a, b) => b.fileSizeBytes - a.fileSizeBytes);

    return NextResponse.json({
      byUser,
      byCategory,
      largeFiles,
      versions: {
        totalBytes: totalVersionBytes,
        totalCount: totalVersionCount,
      },
      totalBytes: byUser.reduce((sum, u) => sum + u.bytes, 0),
    });
  } catch (error) {
    console.error("Admin storage failed:", error);
    return NextResponse.json(
      { error: "Failed to load storage" },
      { status: 500 }
    );
  }
}
