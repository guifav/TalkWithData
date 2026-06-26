import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";

/**
 * POST /api/auth/init
 *
 * Called after first login to assign the user's role server-side.
 * This prevents client-side privilege escalation — the Firestore rules
 * block the `role` field on client create, so only this endpoint
 * (using Admin SDK) can set it.
 *
 * Logic:
 * 1. If user doc already has a role → skip (idempotent)
 * 2. If a pendingRoles doc exists for this email → use that role
 * 3. Otherwise → default to "user" (least privilege)
 */
export async function POST(request: NextRequest) {
  const auth = await verifyRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userRef = adminDb.collection("users").doc(auth.uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      // User doc hasn't been created by client yet — unlikely race condition.
      // Client creates the doc first (without role), then calls this endpoint.
      return NextResponse.json(
        { error: "User document not found. Please try again." },
        { status: 404 }
      );
    }

    const userData = userDoc.data();

    // If role already exists, this is a no-op (idempotent)
    if (userData?.role) {
      return NextResponse.json({
        role: userData.role,
        alreadySet: true,
      });
    }

    // Check for pre-assigned role in pendingRoles collection
    let role: "user" | "admin" | "superadmin" = "user";
    if (auth.email) {
      const pendingId = auth.email.replace("@", "_at_").replaceAll(".", "_");
      const pendingDoc = await adminDb
        .collection("pendingRoles")
        .doc(pendingId)
        .get();

      if (pendingDoc.exists) {
        const pendingRole = pendingDoc.data()?.role;
        if (
          pendingRole &&
          ["user", "admin", "superadmin"].includes(pendingRole)
        ) {
          role = pendingRole;
        }
        // Clean up the pending role after use
        await pendingDoc.ref.delete().catch(() => {});
      }
    }

    // Set role via Admin SDK (bypasses Firestore rules)
    await userRef.update({ role });

    return NextResponse.json({ role, alreadySet: false });
  } catch (error) {
    console.error("[Auth Init] Failed to assign role:", error);
    return NextResponse.json(
      { error: "Failed to initialize user role" },
      { status: 500 }
    );
  }
}
