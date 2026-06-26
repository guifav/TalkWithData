import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  arrayUnion,
  arrayRemove,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export interface Folder {
  id: string;
  name: string;
  color: string | null;
  dashboardIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

function foldersRef(uid: string) {
  return collection(db, "users", uid, "folders");
}

/**
 * Real-time listener for user folders with automatic retry.
 * Firestore's onError is terminal — the listener dies after it fires.
 * This re-subscribes with exponential backoff (1s → 30s max).
 */
export function subscribeToFolders(
  uid: string,
  callback: (folders: Folder[]) => void
): () => void {
  let unsub: (() => void) | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let backoff = 1000;
  let cancelled = false;

  function subscribe() {
    const q = query(foldersRef(uid), orderBy("createdAt", "asc"));
    unsub = onSnapshot(
      q,
      (snapshot) => {
        backoff = 1000;
        const folders = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Folder[];
        callback(folders);
      },
      (error) => {
        console.warn(`[subscribeToFolders] listener error (${error.code}), retrying in ${backoff}ms`);
        if (!cancelled) {
          retryTimer = setTimeout(() => {
            if (!cancelled) subscribe();
          }, backoff);
          backoff = Math.min(backoff * 2, 30000);
        }
      }
    );
  }

  subscribe();

  return () => {
    cancelled = true;
    if (retryTimer) clearTimeout(retryTimer);
    if (unsub) unsub();
  };
}

/** Create a new folder */
export async function createFolder(uid: string, name: string, color?: string): Promise<string> {
  const ref = doc(foldersRef(uid));
  await setDoc(ref, {
    name,
    color: color || null,
    dashboardIds: [],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return ref.id;
}

/** Rename a folder */
export async function renameFolder(uid: string, folderId: string, name: string): Promise<void> {
  await updateDoc(doc(db, "users", uid, "folders", folderId), {
    name,
    updatedAt: Timestamp.now(),
  });
}

/** Delete a folder (does NOT delete dashboards) */
export async function deleteFolder(uid: string, folderId: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "folders", folderId));
}

/** Add a dashboard to a folder */
export async function addDashboardToFolder(
  uid: string,
  folderId: string,
  dashboardId: string
): Promise<void> {
  await updateDoc(doc(db, "users", uid, "folders", folderId), {
    dashboardIds: arrayUnion(dashboardId),
    updatedAt: Timestamp.now(),
  });
}

/** Remove a dashboard from a folder */
export async function removeDashboardFromFolder(
  uid: string,
  folderId: string,
  dashboardId: string
): Promise<void> {
  await updateDoc(doc(db, "users", uid, "folders", folderId), {
    dashboardIds: arrayRemove(dashboardId),
    updatedAt: Timestamp.now(),
  });
}

/** Set folder memberships for a dashboard atomically (add to selected, remove from others) */
export async function setDashboardFolders(
  uid: string,
  dashboardId: string,
  selectedFolderIds: string[],
  allFolders: Folder[]
): Promise<void> {
  const selected = new Set(selectedFolderIds);
  const batch = writeBatch(db);
  let hasChanges = false;

  for (const folder of allFolders) {
    const isIn = folder.dashboardIds.includes(dashboardId);
    const shouldBeIn = selected.has(folder.id);
    const ref = doc(db, "users", uid, "folders", folder.id);

    if (shouldBeIn && !isIn) {
      batch.update(ref, {
        dashboardIds: arrayUnion(dashboardId),
        updatedAt: Timestamp.now(),
      });
      hasChanges = true;
    } else if (!shouldBeIn && isIn) {
      batch.update(ref, {
        dashboardIds: arrayRemove(dashboardId),
        updatedAt: Timestamp.now(),
      });
      hasChanges = true;
    }
  }

  if (hasChanges) await batch.commit();
}

/** Remove a dashboard ID from all folders of a user */
export async function removeDashboardFromAllFolders(
  uid: string,
  dashboardId: string
): Promise<void> {
  const q = query(foldersRef(uid));
  const { getDocs } = await import("firebase/firestore");
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  let hasChanges = false;

  for (const folderDoc of snap.docs) {
    const data = folderDoc.data();
    if ((data.dashboardIds || []).includes(dashboardId)) {
      batch.update(folderDoc.ref, {
        dashboardIds: arrayRemove(dashboardId),
        updatedAt: Timestamp.now(),
      });
      hasChanges = true;
    }
  }

  if (hasChanges) await batch.commit();
}
