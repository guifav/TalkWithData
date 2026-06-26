import type { Dashboard } from "@/lib/types";

/**
 * Centralized permission check for dashboard visibility.
 *
 * Returns true if:
 * - User is the dashboard owner
 * - Dashboard visibility is "team" (everyone)
 * - User's email is in allowedEmails
 * - User belongs to any department in allowedDepartments
 */
export function canViewDashboard(
  dashboard: Pick<Dashboard, "createdBy" | "visibility" | "allowedEmails" | "allowedDepartments">,
  user: { uid: string; email: string },
  userDepartmentIds: string[] = []
): boolean {
  // Owner can always view
  if (dashboard.createdBy === user.uid) return true;

  // Team visibility = everyone
  if (dashboard.visibility === "team") return true;

  // Check email allowlist
  if (
    Array.isArray(dashboard.allowedEmails) &&
    dashboard.allowedEmails.includes(user.email.toLowerCase())
  ) {
    return true;
  }

  // Check department membership
  if (
    Array.isArray(dashboard.allowedDepartments) &&
    dashboard.allowedDepartments.length > 0 &&
    userDepartmentIds.length > 0
  ) {
    return dashboard.allowedDepartments.some((deptId) =>
      userDepartmentIds.includes(deptId)
    );
  }

  return false;
}

/**
 * Server-side check: does the user have access to a dashboard via shared folders?
 *
 * This queries Firestore for shared-folders that contain the dashboard,
 * then checks if the user has access to any of those folders.
 *
 * Call this ONLY when direct access (canViewDashboard) fails — lazy evaluation.
 */
export async function canViewDashboardViaSharedFolder(
  dashboardId: string,
  user: { uid: string; email: string },
  adminDb: FirebaseFirestore.Firestore
): Promise<{ allowed: boolean; folderName?: string; folderId?: string }> {
  // Find shared folders containing this dashboard
  const snap = await adminDb
    .collection("shared-folders")
    .where("dashboardIds", "array-contains", dashboardId)
    .get();

  if (snap.empty) return { allowed: false };

  const email = user.email.toLowerCase();

  // Check each folder for access
  for (const doc of snap.docs) {
    const data = doc.data();

    // Owner of the folder
    if (data.createdBy === user.uid) {
      return { allowed: true, folderName: data.name, folderId: doc.id };
    }

    // Shared with email
    if (
      Array.isArray(data.sharedWithEmails) &&
      data.sharedWithEmails.includes(email)
    ) {
      return { allowed: true, folderName: data.name, folderId: doc.id };
    }
  }

  // Check department-based access (one query for all folders)
  const foldersWithDepts = snap.docs.filter(
    (doc) =>
      Array.isArray(doc.data().sharedWithDepartments) &&
      doc.data().sharedWithDepartments.length > 0
  );

  if (foldersWithDepts.length > 0) {
    const deptSnap = await adminDb
      .collection("departments")
      .where("memberUids", "array-contains", user.uid)
      .get();
    const userDeptIds = new Set(deptSnap.docs.map((d) => d.id));

    for (const doc of foldersWithDepts) {
      const data = doc.data();
      if (data.sharedWithDepartments.some((id: string) => userDeptIds.has(id))) {
        return { allowed: true, folderName: data.name, folderId: doc.id };
      }
    }
  }

  return { allowed: false };
}
