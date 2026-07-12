import {
  collection,
  doc,
  getDoc,
  getDocs as getDocsFB,
  documentId,
  onSnapshot,
  query,
  where,
  orderBy,
  type Query,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { authFetch } from "@/lib/firebase/auth";
import type { Dashboard } from "@/lib/types";

/**
 * Wraps onSnapshot with automatic retry on terminal errors.
 * Firestore's onError callback is terminal — the listener is dead after it fires.
 * This helper re-subscribes with exponential backoff (1s, 2s, 4s, max 30s).
 * Returns an unsubscribe function that also cancels pending retries.
 */
function resilientSnapshot(
  q: Query<DocumentData, DocumentData>,
  onNext: (docs: Array<{ id: string } & DocumentData>) => void,
  label: string
): () => void {
  let unsub: (() => void) | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let backoff = 1000;
  let cancelled = false;

  function subscribe() {
    unsub = onSnapshot(
      q,
      (snapshot) => {
        backoff = 1000; // reset on success
        onNext(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => {
        console.warn(`[${label}] listener error (${error.code}), retrying in ${backoff}ms`);
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

const COLLECTION = "dashboards";

function dashboardsRef() {
  return collection(db, COLLECTION);
}

export function subscribeToDashboards(
  userId: string,
  callback: (dashboards: Dashboard[]) => void,
): () => void {
  // Firestore rules can prove owner and team list queries. Dynamic email and
  // department membership cannot be proven safely for list queries, so those
  // IDs are resolved by the authenticated server and read back individually.
  const accessQueries = [
    query(
      dashboardsRef(),
      where("archivedAt", "==", null),
      where("createdBy", "==", userId),
      orderBy("createdAt", "desc"),
    ),
    query(
      dashboardsRef(),
      where("archivedAt", "==", null),
      where("visibility", "==", "team"),
      orderBy("createdAt", "desc"),
    ),
  ];

  const docsByQuery: Dashboard[][] = [...accessQueries.map(() => []), []];
  const serverIndex = docsByQuery.length - 1;
  let cancelled = false;

  function emitMerged() {
    const seen = new Set<string>();
    const merged: Dashboard[] = [];
    for (const d of docsByQuery.flat()) {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        merged.push(d);
      }
    }
    // Sort by createdAt descending
    merged.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() ?? 0;
      const bTime = b.createdAt?.toMillis?.() ?? 0;
      return bTime - aTime;
    });
    callback(merged);
  }

  const unsubscribers = accessQueries.map((accessQuery, index) =>
    resilientSnapshot(
      accessQuery,
      (docs) => {
        docsByQuery[index] = docs as Dashboard[];
        emitMerged();
      },
      `subscribeToDashboards:${index}`,
    )
  );

  void authFetch("/api/dashboards?scope=active-ids")
    .then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as { ids?: unknown };
      const ids = Array.isArray(payload.ids)
        ? payload.ids.filter((id): id is string => typeof id === "string")
        : [];
      const results = await Promise.allSettled(ids.map((id) => getDashboard(id)));
      if (cancelled) return;
      docsByQuery[serverIndex] = results.flatMap((result) =>
        result.status === "fulfilled" && result.value ? [result.value] : []
      );
      emitMerged();
    })
    .catch((error: unknown) => {
      if (!cancelled) {
        console.warn("[subscribeToDashboards:accessible-ids] request failed", error);
      }
    });

  return () => {
    cancelled = true;
    for (const unsubscribe of unsubscribers) unsubscribe();
  };
}

export function subscribeToArchivedDashboards(
  userId: string,
  callback: (dashboards: Dashboard[]) => void
): () => void {
  const q = query(
    dashboardsRef(),
    where("createdBy", "==", userId),
    where("archivedAt", "!=", null),
    orderBy("archivedAt", "desc")
  );

  return resilientSnapshot(
    q,
    (docs) => callback(docs as Dashboard[]),
    "subscribeToArchivedDashboards"
  );
}

/**
 * Fetch multiple dashboards by their IDs (client-side).
 * Firestore `in` queries accept up to 30 values per batch.
 */
export async function getDashboardsByIds(ids: string[]): Promise<Dashboard[]> {
  if (ids.length === 0) return [];
  const results: Dashboard[] = [];
  // Firestore `in` supports up to 30 values
  for (let i = 0; i < ids.length; i += 30) {
    const batch = ids.slice(i, i + 30);
    const q = query(dashboardsRef(), where(documentId(), "in", batch));
    const snap = await getDocsFB(q);
    for (const d of snap.docs) {
      const data = d.data() as Dashboard;
      if (!data.archivedAt) {
        results.push({ ...data, id: d.id });
      }
    }
  }
  return results;
}

export async function getDashboard(id: string): Promise<Dashboard | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Dashboard;
}

/** Resolve a dashboard by slug or Firestore ID */
export async function getDashboardByIdOrSlug(idOrSlug: string): Promise<Dashboard | null> {
  // Try by ID first (fast, single doc read)
  const byId = await getDashboard(idOrSlug);
  if (byId) return byId;

  // Fallback: query by slug
  const { getDocs: getDocsFn } = await import("firebase/firestore");
  const q = query(dashboardsRef(), where("slug", "==", idOrSlug));
  const snap = await getDocsFn(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Dashboard;
}

export async function updateDashboard(
  id: string,
  data: Partial<Pick<Dashboard, "title" | "description" | "category" | "visibility" | "allowedEmails" | "allowedDepartments" | "slug">>
): Promise<void> {
  const res = await authFetch(`/api/dashboards/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to update dashboard");
  }
}

export async function archiveDashboard(id: string): Promise<void> {
  const res = await authFetch(`/api/dashboards/${id}/archive`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to archive dashboard");
  }
}

export async function unarchiveDashboard(id: string): Promise<void> {
  const res = await authFetch(`/api/dashboards/${id}/archive`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to unarchive dashboard");
  }
}
