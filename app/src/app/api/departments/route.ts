import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";

/**
 * GET /api/departments
 * List all departments (read-only). Any authenticated user can access.
 * Returns only id, name, and description (no memberUids for privacy).
 */
export async function GET(request: NextRequest) {
  const auth = await verifyRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const snap = await adminDb.collection("departments").orderBy("name").get();
    const departments = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        description: data.description || null,
      };
    });
    return NextResponse.json({ departments });
  } catch (error) {
    console.error("List departments failed:", error);
    return NextResponse.json(
      { error: "Failed to list departments" },
      { status: 500 }
    );
  }
}
