import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";

export async function GET(request: NextRequest) {
  const auth = await verifyRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const snapshot = await adminDb
      .collection("dashboards")
      .orderBy("createdAt", "desc")
      .get();

    const dashboards = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ dashboards });
  } catch (error) {
    console.error("Failed to list dashboards:", error);
    return NextResponse.json(
      { error: "Failed to list dashboards" },
      { status: 500 }
    );
  }
}
