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
 * token record exists under that dashboard, is bound to it, and has not expired.
 */
export async function verifyEmbedToken(
  dashboardId: string,
  token: string
): Promise<boolean> {
  // Tokens are 32 random bytes, base64url encoded. Reject anything else before
  // using the value as a Firestore document id (a "/" would make .doc() throw
  // and turn a bad query param into a 500 instead of a 401).
  if (!dashboardId || !token || !/^[A-Za-z0-9_-]+$/.test(token)) {
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

  // Check expiry
  const expiresAt = data.expiresAt?.toDate?.()
    ? data.expiresAt.toDate()
    : new Date(data.expiresAt);

  if (expiresAt < new Date()) {
    // Cleanup expired token
    await doc.ref.delete().catch(() => {});
    return false;
  }

  return true;
}
