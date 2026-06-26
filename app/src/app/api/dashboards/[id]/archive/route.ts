import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const doc = await adminDb.collection("dashboards").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data = doc.data();
    if (data?.createdBy !== auth.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const isArchived = data?.archivedAt != null;

    if (isArchived) {
      // Unarchive
      await adminDb.collection("dashboards").doc(id).update({
        archivedAt: null,
        archivedBy: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      // Archive
      await adminDb.collection("dashboards").doc(id).update({
        archivedAt: FieldValue.serverTimestamp(),
        archivedBy: auth.uid,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({ success: true, archived: !isArchived });
  } catch (error) {
    console.error("Failed to toggle archive:", error);
    return NextResponse.json(
      { error: "Failed to toggle archive" },
      { status: 500 }
    );
  }
}
