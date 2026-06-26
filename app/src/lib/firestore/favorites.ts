import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { FavoriteDoc, RecentDoc } from "@/lib/types";

export interface ViewedDoc {
  dashboardId: string;
  lastViewedAt: Timestamp;
}

// ── Favorites ──────────────────────────────────────────

function favoritesRef(uid: string) {
  return collection(db, "users", uid, "favorites");
}

export async function getFavorites(uid: string): Promise<FavoriteDoc[]> {
  const q = query(favoritesRef(uid), orderBy("favoritedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    dashboardId: d.id,
    ...d.data(),
  })) as FavoriteDoc[];
}

export async function addFavorite(
  uid: string,
  dashboardId: string
): Promise<void> {
  await setDoc(doc(db, "users", uid, "favorites", dashboardId), {
    dashboardId,
    favoritedAt: Timestamp.now(),
  });
}

export async function removeFavorite(
  uid: string,
  dashboardId: string
): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "favorites", dashboardId));
}

// ── Recently Viewed ────────────────────────────────────

function recentRef(uid: string) {
  return collection(db, "users", uid, "recent");
}

export async function getRecent(uid: string): Promise<RecentDoc[]> {
  const q = query(recentRef(uid), orderBy("viewedAt", "desc"), limit(10));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    dashboardId: d.id,
    ...d.data(),
  })) as RecentDoc[];
}

export async function trackRecentView(
  uid: string,
  dashboardId: string
): Promise<void> {
  await setDoc(doc(db, "users", uid, "recent", dashboardId), {
    dashboardId,
    viewedAt: Timestamp.now(),
  });
}

// ── Viewed Timestamps (for "Updated" badge) ───────────

export async function getViewedTimestamps(
  uid: string
): Promise<Map<string, Timestamp>> {
  const q = query(collection(db, "users", uid, "viewed"));
  const snap = await getDocs(q);
  const map = new Map<string, Timestamp>();
  for (const d of snap.docs) {
    const data = d.data();
    if (data.lastViewedAt) {
      map.set(d.id, data.lastViewedAt as Timestamp);
    }
  }
  return map;
}
