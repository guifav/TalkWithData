import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import crypto from "crypto";

const EMBED_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface EmbedToken {
  token: string;
  dashboardId: string;
  createdBy: string;
  createdByEmail: string;
  expiresAt: FirebaseFirestore.Timestamp;
  createdAt: FirebaseFirestore.Timestamp;
}

/**
 * Generate a short-lived embed token for a dashboard.
 * Stored in Firestore under `dashboards/{id}/embedTokens/{token}`.
 */
export async function createEmbedToken(
  dashboardId: string,
  user: { uid: string; email: string }
): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + EMBED_TOKEN_TTL_MS);

  await adminDb
    .collection("dashboards")
    .doc(dashboardId)
    .collection("embedTokens")
    .doc(token)
    .set({
      token,
      dashboardId,
      createdBy: user.uid,
      createdByEmail: user.email,
      expiresAt,
      createdAt: FieldValue.serverTimestamp(),
    });

  return token;
}

/**
 * Verify an embed token for a specific dashboard. Returns true only when the
 * token record exists under that dashboard, is bound to it, has a non-empty
 * createdBy, and has not expired.
 */
export async function verifyEmbedToken(
  dashboardId: string,
  token: string
): Promise<boolean> {
  // dashboardId is a route param used as a Firestore doc id; embed tokens are
  // 32 random bytes base64url encoded (exactly 43 chars). Reject anything else
  // before calling .doc(), so a bad or crafted value is a clean rejection
  // instead of a 500 (a "/" would make .doc() throw).
  if (
    !dashboardId ||
    !/^[A-Za-z0-9_-]{1,1500}$/.test(dashboardId) ||
    !token ||
    !/^[A-Za-z0-9_-]{43}$/.test(token)
  ) {
    return false;
  }

  const doc = await adminDb
    .collection("dashboards")
    .doc(dashboardId)
    .collection("embedTokens")
    .doc(token)
    .get();

  if (!doc.exists) return false;

  const data = doc.data();
  if (!data) return false;

  // Defense in depth (issue #30): the lookup path already scopes the token to
  // this dashboard, but also require the stored binding and provenance so a
  // misplaced, hand-written, or migrated record cannot authorize a view.
  if (data.dashboardId !== dashboardId) return false;
  if (typeof data.createdBy !== "string" || data.createdBy.length === 0) {
    return false;
  }

  // Check expiry. Reject a missing or invalid expiry rather than letting an
  // Invalid Date comparison (always false) accept the token indefinitely.
  let expiresAt: Date;
  try {
    const rawExpiry = data.expiresAt;
    expiresAt =
      rawExpiry && typeof rawExpiry.toDate === "function"
        ? rawExpiry.toDate()
        : new Date(rawExpiry);
  } catch {
    // A corrupt record (for example a poisoned valueOf/toString, or a toDate
    // that throws) must be rejected cleanly, never propagate a 500.
    return false;
  }

  if (!(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime())) {
    return false;
  }

  if (expiresAt < new Date()) {
    // Cleanup expired token
    await doc.ref.delete().catch(() => {});
    return false;
  }

  return true;
}
