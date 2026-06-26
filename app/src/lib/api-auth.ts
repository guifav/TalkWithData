import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

const ALLOWED_DOMAIN = "griinstitute.org";
const AUTH_COOKIE_NAME = "dashs_auth";

export type UserRole = "user" | "admin" | "superadmin";

export type AuthResult = {
  uid: string;
  email: string;
  name?: string;
  role?: UserRole;
};

export async function verifyRequest(
  request: NextRequest
): Promise<AuthResult | null> {
  const authHeader = request.headers.get("Authorization");
  const cookieToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : cookieToken;
  if (!token) return null;

  try {
    // SA is from a different project, so we need checkRevoked=false
    // The projectId in initializeApp handles audience validation
    const decoded = await adminAuth.verifyIdToken(token, false);
    if (!decoded.email?.endsWith(`@${ALLOWED_DOMAIN}`)) {
      console.log(`[Auth] Domain mismatch: ${decoded.email}`);
      return null;
    }
    return { uid: decoded.uid, email: decoded.email, name: decoded.name };
  } catch (err) {
    console.error("[Auth] verifyIdToken failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Verify that the request comes from an Admin or Super Admin.
 * Returns AuthResult with role, or null if not authenticated/not admin.
 */
export async function verifyAdmin(
  request: NextRequest
): Promise<AuthResult | null> {
  const auth = await verifyRequest(request);
  if (!auth) return null;

  try {
    const userDoc = await adminDb.collection("users").doc(auth.uid).get();
    const role = (userDoc.data()?.role as UserRole) || "user";
    if (role !== "superadmin" && role !== "admin") return null;
    return { ...auth, role };
  } catch (err) {
    console.error("[Auth] Failed to check admin role:", err);
    return null;
  }
}

/**
 * Verify that the request comes from a Super Admin.
 * Returns AuthResult with role, or null if not authenticated/not admin.
 */
export async function verifySuperAdmin(
  request: NextRequest
): Promise<AuthResult | null> {
  const auth = await verifyRequest(request);
  if (!auth) return null;

  try {
    const userDoc = await adminDb.collection("users").doc(auth.uid).get();
    const role = (userDoc.data()?.role as UserRole) || "user";
    if (role !== "superadmin") return null;
    return { ...auth, role };
  } catch (err) {
    console.error("[Auth] Failed to check admin role:", err);
    return null;
  }
}
