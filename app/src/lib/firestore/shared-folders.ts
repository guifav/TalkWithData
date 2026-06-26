import { authFetch } from "@/lib/firebase/auth";

export interface SharedFolder {
  id: string;
  name: string;
  color: string | null;
  dashboardIds: string[];
  sharedWithEmails: string[];
  sharedWithDepartments: string[];
  createdBy: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
}

/** List shared folders visible to the current user */
export async function listSharedFolders(): Promise<SharedFolder[]> {
  const res = await authFetch("/api/shared-folders");
  if (!res.ok) throw new Error("Failed to load shared folders");
  const data = await res.json();
  return data.folders ?? [];
}

/** Get a single shared folder by ID */
export async function getSharedFolder(id: string): Promise<SharedFolder> {
  const res = await authFetch(`/api/shared-folders/${id}`);
  if (!res.ok) throw new Error("Failed to load shared folder");
  return res.json();
}

/** Create a new shared folder */
export async function createSharedFolder(params: {
  name: string;
  color?: string;
  sharedWithEmails?: string[];
  sharedWithDepartments?: string[];
}): Promise<SharedFolder> {
  const res = await authFetch("/api/shared-folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create shared folder");
  }
  return res.json();
}

/** Update a shared folder (owner only) */
export async function updateSharedFolder(
  id: string,
  updates: Partial<{
    name: string;
    color: string | null;
    dashboardIds: string[];
    sharedWithEmails: string[];
    sharedWithDepartments: string[];
  }>
): Promise<SharedFolder> {
  const res = await authFetch(`/api/shared-folders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to update shared folder");
  }
  return res.json();
}

/** Delete a shared folder (owner only) */
export async function deleteSharedFolder(id: string): Promise<void> {
  const res = await authFetch(`/api/shared-folders/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to delete shared folder");
  }
}

/** Add a dashboard to a shared folder */
export async function addDashboardToSharedFolder(
  folderId: string,
  dashboardId: string
): Promise<void> {
  const folder = await getSharedFolder(folderId);
  if (folder.dashboardIds.includes(dashboardId)) return;
  await updateSharedFolder(folderId, {
    dashboardIds: [...folder.dashboardIds, dashboardId],
  });
}

/** Remove a dashboard from a shared folder */
export async function removeDashboardFromSharedFolder(
  folderId: string,
  dashboardId: string
): Promise<void> {
  const folder = await getSharedFolder(folderId);
  await updateSharedFolder(folderId, {
    dashboardIds: folder.dashboardIds.filter((id) => id !== dashboardId),
  });
}
