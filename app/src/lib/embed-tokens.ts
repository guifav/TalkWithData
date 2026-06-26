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
 * Verify an embed token. Returns the dashboard ID if valid, null otherwise.
 */
export async function verifyEmbedToken(
  dashboardId: string,
  token: string
): Promise<boolean> {
  const doc = await adminDb
    .collection("dashboards")
    .doc(dashboardId)
    .collection("embedTokens")
    .doc(token)
    .get();

  if (!doc.exists) return false;

  const data = doc.data();
  if (!data) return false;

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
