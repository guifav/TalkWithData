import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, verifySuperAdmin, type UserRole } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";
import { sanitizeAiConfig, type AiModelConfig } from "@/lib/ai-model";
import {
  AiConfigSecretError,
  updateUserAiConfig,
} from "@/lib/ai-config-secrets";

const VALID_ROLES: UserRole[] = ["user", "admin", "superadmin"];

/**
 * PATCH /api/admin/users
 * Change a user's role or AI model config.
 * - superadmin: can change another user's role or AI model config
 * - admin: cannot mutate role/config
 * Body: { uid: string, role: "user" | "admin" | "superadmin" } or { uid: string, aiConfig: AiModelConfig | null }
 */
export async function PATCH(request: NextRequest) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { uid, role, aiConfig } = body as {
      uid?: string;
      role?: string;
      aiConfig?: AiModelConfig | null;
    };

    // Handle AI config update
    if (uid && aiConfig !== undefined) {
      const storedConfig = await updateUserAiConfig(uid, aiConfig);
      return NextResponse.json({ success: true, uid, aiConfig: sanitizeAiConfig(storedConfig) });
    }

    if (!uid || !role || !VALID_ROLES.includes(role as UserRole)) {
      return NextResponse.json(
        { error: "Invalid request. Required: uid + role, or uid + aiConfig" },
        { status: 400 }
      );
    }

    // Prevent self-modification
    if (uid === auth.uid) {
      return NextResponse.json(
        { error: "Superadmins cannot change their own role" },
        { status: 403 }
      );
    }

    // Check target user exists
    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await adminDb.collection("users").doc(uid).update({ role });

    return NextResponse.json({ success: true, uid, role });
  } catch (error) {
    if (error instanceof AiConfigSecretError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Admin role change failed:", error);
    return NextResponse.json(
      { error: "Failed to update role" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const usersSnap = await adminDb.collection("users").get();
    const dashboardsSnap = await adminDb.collection("dashboards").get();

    // Count dashboards created per user
    const dashboardsPerUser = new Map<string, number>();
    for (const doc of dashboardsSnap.docs) {
      const uid = doc.data().createdBy;
      if (uid) {
        dashboardsPerUser.set(uid, (dashboardsPerUser.get(uid) || 0) + 1);
      }
    }

    // Count total views generated per dashboard owner
    const viewsPerOwner = new Map<string, number>();
    for (const doc of dashboardsSnap.docs) {
      const uid = doc.data().createdBy;
      const views = doc.data().viewCount || 0;
      if (uid) {
        viewsPerOwner.set(uid, (viewsPerOwner.get(uid) || 0) + views);
      }
    }

    const users = usersSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        uid: doc.id,
        email: data.email || "Unknown",
        displayName: data.displayName || "Unknown",
        role: data.role || "user",
        department: data.department || undefined,
        aiConfig: sanitizeAiConfig(data.aiConfig),
        dashboardsCreated: dashboardsPerUser.get(doc.id) || 0,
        totalViewsGenerated: viewsPerOwner.get(doc.id) || 0,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        lastLoginAt: data.lastLoginAt?.toDate?.()?.toISOString() || null,
      };
    });

    // Sort by lastLoginAt desc
    users.sort((a, b) => {
      if (!a.lastLoginAt) return 1;
      if (!b.lastLoginAt) return -1;
      return b.lastLoginAt.localeCompare(a.lastLoginAt);
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Admin users failed:", error);
    return NextResponse.json(
      { error: "Failed to load users" },
      { status: 500 }
    );
  }
}
