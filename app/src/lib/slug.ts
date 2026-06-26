/**
 * Slug utilities for friendly dashboard URLs.
 * Pattern: dashs.mygri.com/view/my-dashboard-title
 *
 * Uniqueness is enforced via a transactional reservation in the
 * `slugs` collection (one doc per slug, value = dashboard ID).
 */

/**
 * Generate a URL-safe slug from a title.
 */
export function generateSlug(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);
}

/**
 * Reserve a unique slug transactionally.
 *
 * Uses a `slugs/{slug}` collection as a uniqueness index.
 * Inside a Firestore transaction:
 *   1. Check if slug doc exists
 *   2. If free (or owned by same dashboard), reserve it
 *   3. If taken, try with numeric suffix
 *
 * @param slug - Base slug candidate
 * @param dashboardId - The dashboard claiming this slug
 * @returns The reserved (possibly suffixed) slug
 */
export async function reserveUniqueSlug(
  slug: string,
  dashboardId: string
): Promise<string> {
  const { adminDb } = await import("@/lib/firebase/admin");

  // Try base slug, then -2, -3, etc.
  for (let suffix = 0; suffix < 20; suffix++) {
    const candidate = suffix === 0 ? slug : `${slug}-${suffix + 1}`;

    const reserved = await adminDb.runTransaction(async (tx) => {
      const slugRef = adminDb.collection("slugs").doc(candidate);
      const slugDoc = await tx.get(slugRef);

      if (!slugDoc.exists) {
        // Free — reserve it
        tx.set(slugRef, { dashboardId, reservedAt: new Date() });
        return true;
      }

      // Exists — check if same dashboard (idempotent rename)
      if (slugDoc.data()?.dashboardId === dashboardId) {
        return true;
      }

      // Taken by another dashboard
      return false;
    });

    if (reserved) return candidate;
  }

  // Fallback: append timestamp (transactional to prevent race conditions)
  const fallback = `${slug}-${Date.now().toString(36)}`;
  const reserved = await adminDb.runTransaction(async (tx) => {
    const ref = adminDb.collection("slugs").doc(fallback);
    const doc = await tx.get(ref);
    if (doc.exists && doc.data()?.dashboardId !== dashboardId) {
      // Extremely unlikely collision — add random suffix
      const retry = `${slug}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const retryRef = adminDb.collection("slugs").doc(retry);
      tx.set(retryRef, { dashboardId, reservedAt: new Date() });
      return retry;
    }
    tx.set(ref, { dashboardId, reservedAt: new Date() });
    return fallback;
  });
  return reserved;
}

/**
 * Release a slug reservation (on dashboard delete).
 */
export async function releaseSlug(slug: string): Promise<void> {
  if (!slug) return;
  const { adminDb } = await import("@/lib/firebase/admin");
  await adminDb.collection("slugs").doc(slug).delete().catch(() => {});
}
