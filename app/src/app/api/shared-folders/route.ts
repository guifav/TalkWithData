import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

const COLLECTION = "shared-folders";

/**
 * GET /api/shared-folders
 * List shared folders visible to the current user:
 * - Created by them
 * - Shared with their email
 * - Shared with a department they belong to
 */
export async function GET(request: NextRequest) {
  const auth = await verifyRequest(request);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const email = auth.email.toLowerCase();

    // Get user's department IDs
    const deptSnap = await adminDb
      .collection("departments")
      .where("memberUids", "array-contains", auth.uid)
      .get();
    const userDeptIds = deptSnap.docs.map((d) => d.id);

    // Firestore doesn't support OR queries across different fields natively,
    // so we run parallel queries and merge results.
    const queries = [
      // Folders created by the user
      adminDb.collection(COLLECTION).where("createdBy", "==", auth.uid).get(),
      // Folders shared with user's email
      adminDb
        .collection(COLLECTION)
        .where("sharedWithEmails", "array-contains", email)
        .get(),
    ];

    // Add department queries (one per department — Firestore array-contains limitation)
    for (const deptId of userDeptIds) {
      queries.push(
        adminDb
          .collection(COLLECTION)
          .where("sharedWithDepartments", "array-contains", deptId)
          .get()
      );
    }

    const results = await Promise.all(queries);

    // Deduplicate by folder ID
    const folderMap = new Map<string, FirebaseFirestore.DocumentData>();
    for (const snap of results) {
      for (const doc of snap.docs) {
        if (!folderMap.has(doc.id)) {
          folderMap.set(doc.id, { id: doc.id, ...doc.data() });
        }
      }
    }

    const folders = Array.from(folderMap.values()).sort(
      (a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0)
    );

    return NextResponse.json({ folders });
  } catch (error) {
    console.error("Failed to list shared folders:", error);
    return NextResponse.json(
      { error: "Failed to list shared folders" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/shared-folders
 * Create a new shared folder (any authenticated user).
 */
export async function POST(request: NextRequest) {
  const auth = await verifyRequest(request);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const name = (body.name || "").trim();
    if (!name) {
      return NextResponse.json(
        { error: "Folder name is required" },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection(COLLECTION).doc();
    const now = FieldValue.serverTimestamp();

    const folderData = {
      name,
      color: body.color || null,
      dashboardIds: [],
      sharedWithEmails: (body.sharedWithEmails || []).map((e: string) =>
        e.trim().toLowerCase()
      ),
      sharedWithDepartments: body.sharedWithDepartments || [],
      createdBy: auth.uid,
      createdByEmail: auth.email,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(folderData);

    // Read back to return with resolved timestamps
    const created = await docRef.get();
    return NextResponse.json({ id: docRef.id, ...created.data() }, { status: 201 });
  } catch (error) {
    console.error("Failed to create shared folder:", error);
    return NextResponse.json(
      { error: "Failed to create shared folder" },
      { status: 500 }
    );
  }
}
