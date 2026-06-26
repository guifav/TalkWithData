import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

const COLLECTION = "shared-folders";

/** Check if a user has access to a shared folder */
async function userHasAccess(
  folderId: string,
  auth: { uid: string; email: string }
): Promise<{ hasAccess: boolean; isOwner: boolean; data: FirebaseFirestore.DocumentData | null }> {
  const doc = await adminDb.collection(COLLECTION).doc(folderId).get();
  if (!doc.exists) return { hasAccess: false, isOwner: false, data: null };

  const data = doc.data()!;
  const isOwner = data.createdBy === auth.uid;
  if (isOwner) return { hasAccess: true, isOwner: true, data: { id: doc.id, ...data } };

  const email = auth.email.toLowerCase();
  if (
    Array.isArray(data.sharedWithEmails) &&
    data.sharedWithEmails.includes(email)
  ) {
    return { hasAccess: true, isOwner: false, data: { id: doc.id, ...data } };
  }

  // Check department membership
  if (
    Array.isArray(data.sharedWithDepartments) &&
    data.sharedWithDepartments.length > 0
  ) {
    const deptSnap = await adminDb
      .collection("departments")
      .where("memberUids", "array-contains", auth.uid)
      .get();
    const userDeptIds = deptSnap.docs.map((d) => d.id);
    if (data.sharedWithDepartments.some((id: string) => userDeptIds.includes(id))) {
      return { hasAccess: true, isOwner: false, data: { id: doc.id, ...data } };
    }
  }

  return { hasAccess: false, isOwner: false, data: null };
}

/**
 * GET /api/shared-folders/[id]
 * Get a single shared folder (if user has access).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyRequest(request);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const { hasAccess, data } = await userHasAccess(id, auth);
    if (!hasAccess || !data)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to get shared folder:", error);
    return NextResponse.json(
      { error: "Failed to get shared folder" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/shared-folders/[id]
 * Update a shared folder (owner only).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyRequest(request);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const { hasAccess, isOwner } = await userHasAccess(id, auth);
    if (!hasAccess)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!isOwner)
      return NextResponse.json({ error: "Only the folder owner can edit" }, { status: 403 });

    const body = await request.json();
    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.color !== undefined) updates.color = body.color;
    if (body.dashboardIds !== undefined) {
      // Validate: user can only add dashboards they own
      const invalidIds: string[] = [];
      for (const dashId of body.dashboardIds) {
        const dashDoc = await adminDb.collection("dashboards").doc(dashId).get();
        if (!dashDoc.exists || dashDoc.data()?.createdBy !== auth.uid) {
          invalidIds.push(dashId);
        }
      }
      if (invalidIds.length > 0) {
        return NextResponse.json(
          { error: `Cannot share dashboards you don't own: ${invalidIds.join(", ")}` },
          { status: 403 }
        );
      }
      updates.dashboardIds = body.dashboardIds;
    }
    if (body.sharedWithEmails !== undefined) {
      updates.sharedWithEmails = body.sharedWithEmails.map((e: string) =>
        e.trim().toLowerCase()
      );
    }
    if (body.sharedWithDepartments !== undefined) {
      updates.sharedWithDepartments = body.sharedWithDepartments;
    }

    await adminDb.collection(COLLECTION).doc(id).update(updates);

    const updated = await adminDb.collection(COLLECTION).doc(id).get();
    return NextResponse.json({ id: updated.id, ...updated.data() });
  } catch (error) {
    console.error("Failed to update shared folder:", error);
    return NextResponse.json(
      { error: "Failed to update shared folder" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/shared-folders/[id]
 * Delete a shared folder (owner only).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyRequest(request);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const { hasAccess, isOwner } = await userHasAccess(id, auth);
    if (!hasAccess)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!isOwner)
      return NextResponse.json({ error: "Only the folder owner can delete" }, { status: 403 });

    await adminDb.collection(COLLECTION).doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete shared folder:", error);
    return NextResponse.json(
      { error: "Failed to delete shared folder" },
      { status: 500 }
    );
  }
}
