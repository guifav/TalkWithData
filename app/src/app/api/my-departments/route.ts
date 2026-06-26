// GET /api/my-departments — returns department IDs the current user belongs to
import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";

export async function GET(request: NextRequest) {
  const auth = await verifyRequest(request);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const snap = await adminDb
      .collection("departments")
      .where("memberUids", "array-contains", auth.uid)
      .get();
    const departmentIds = snap.docs.map((d) => d.id);
    return NextResponse.json({ departmentIds });
  } catch (error) {
    console.error("Failed to load user departments:", error);
    return NextResponse.json({ departmentIds: [] });
  }
}
