import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";
import { canViewDashboard, canViewDashboardViaSharedFolder } from "@/lib/permissions";

async function getUserDepartmentIds(uid: string) {
  const deptSnap = await adminDb
    .collection("departments")
    .where("memberUids", "array-contains", uid)
    .get();
  return deptSnap.docs.map((doc) => doc.id);
}

function sanitizeDashboardListItem(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    title: data.title || "Untitled",
    description: data.description || null,
    category: data.category || null,
    source: data.source || null,
    visibility: data.visibility || "private",
    createdBy: data.createdBy || null,
    createdByEmail: data.createdByEmail || null,
    createdByName: data.createdByName || null,
    slug: data.slug || null,
    thumbnailUrl: data.thumbnailUrl || null,
    viewCount: data.viewCount || 0,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  };
}

export async function GET(request: NextRequest) {
  const auth = await verifyRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [snapshot, userDepartmentIds] = await Promise.all([
      adminDb.collection("dashboards").orderBy("createdAt", "desc").get(),
      getUserDepartmentIds(auth.uid),
    ]);

    const dashboards = [];
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const directAccess = canViewDashboard(
        {
          createdBy: data.createdBy,
          visibility: data.visibility,
          allowedEmails: Array.isArray(data.allowedEmails) ? data.allowedEmails : [],
          allowedDepartments: Array.isArray(data.allowedDepartments) ? data.allowedDepartments : [],
        },
        auth,
        userDepartmentIds
      );
      const folderAccess = directAccess
        ? false
        : (await canViewDashboardViaSharedFolder(doc.id, auth, adminDb)).allowed;

      if (directAccess || folderAccess) {
        dashboards.push(sanitizeDashboardListItem(doc.id, data));
      }
    }

    return NextResponse.json({ dashboards });
  } catch (error) {
    console.error("Failed to list dashboards:", error);
    return NextResponse.json(
      { error: "Failed to list dashboards" },
      { status: 500 }
    );
  }
}
