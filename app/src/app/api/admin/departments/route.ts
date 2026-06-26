import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * GET /api/admin/departments
 * List all departments. Requires admin+.
 */
export async function GET(request: NextRequest) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const snap = await adminDb.collection("departments").orderBy("name").get();
    const departments = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    return NextResponse.json({ departments });
  } catch (error) {
    console.error("List departments failed:", error);
    return NextResponse.json(
      { error: "Failed to list departments" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/departments
 * Create a new department. Requires superadmin.
 * Body: { name: string, description?: string }
 */
export async function POST(request: NextRequest) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, description } = body as {
      name?: string;
      description?: string;
    };

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Department name is required" },
        { status: 400 }
      );
    }

    // Check for duplicate name
    const existing = await adminDb
      .collection("departments")
      .where("name", "==", name.trim())
      .get();
    if (!existing.empty) {
      return NextResponse.json(
        { error: "A department with this name already exists" },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const docRef = await adminDb.collection("departments").add({
      name: name.trim(),
      description: description?.trim() || null,
      memberUids: [],
      createdBy: auth.uid,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      id: docRef.id,
      name: name.trim(),
      description: description?.trim() || null,
      memberUids: [],
      createdBy: auth.uid,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    console.error("Create department failed:", error);
    return NextResponse.json(
      { error: "Failed to create department" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/departments
 * Update a department. Requires superadmin.
 * Body: { id: string, name?: string, description?: string, addUids?: string[], removeUids?: string[] }
 */
export async function PATCH(request: NextRequest) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, name, description, addUids, removeUids } = body as {
      id?: string;
      name?: string;
      description?: string;
      addUids?: string[];
      removeUids?: string[];
    };

    if (!id) {
      return NextResponse.json(
        { error: "Department id is required" },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection("departments").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json(
          { error: "Department name cannot be empty" },
          { status: 400 }
        );
      }
      // Check duplicate name (excluding current)
      const existing = await adminDb
        .collection("departments")
        .where("name", "==", name.trim())
        .get();
      const conflict = existing.docs.find((d) => d.id !== id);
      if (conflict) {
        return NextResponse.json(
          { error: "A department with this name already exists" },
          { status: 409 }
        );
      }
      updates.name = name.trim();
    }

    if (description !== undefined) {
      updates.description = description.trim() || null;
    }

    // Apply name/description updates first
    if (Object.keys(updates).length > 1) { // >1 because updatedAt is always present
      await docRef.update(updates);
    }

    // Handle member additions — transaction per user for compare-and-swap
    // Each user is moved in its own transaction to prevent concurrent moves
    // from leaving duplicate memberUids across departments.
    if (addUids && addUids.length > 0) {
      for (const uid of addUids) {
        await adminDb.runTransaction(async (tx) => {
          const userRef = adminDb.collection("users").doc(uid);
          const userSnap = await tx.get(userRef);
          const prevDeptId = userSnap.data()?.department;

          // Remove from previous department if different
          if (prevDeptId && prevDeptId !== id) {
            const prevDeptRef = adminDb.collection("departments").doc(prevDeptId);
            tx.update(prevDeptRef, {
              memberUids: FieldValue.arrayRemove(uid),
              updatedAt: new Date().toISOString(),
            });
          }

          // Add to target department + update user doc
          tx.update(docRef, {
            memberUids: FieldValue.arrayUnion(uid),
            updatedAt: new Date().toISOString(),
          });
          tx.update(userRef, { department: id });
        });
      }
    }

    // Handle member removals — transaction per user to avoid wiping
    // a concurrent move's assignment on the user doc.
    if (removeUids && removeUids.length > 0) {
      for (const uid of removeUids) {
        await adminDb.runTransaction(async (tx) => {
          const userRef = adminDb.collection("users").doc(uid);
          const userSnap = await tx.get(userRef);

          // Remove from this department's memberUids unconditionally
          tx.update(docRef, {
            memberUids: FieldValue.arrayRemove(uid),
            updatedAt: new Date().toISOString(),
          });

          // Only clear user.department if it still points at THIS department
          if (userSnap.data()?.department === id) {
            tx.update(userRef, { department: FieldValue.delete() });
          }
        });
      }
    }

    // Return updated doc
    const updated = await docRef.get();
    return NextResponse.json({
      id: updated.id,
      ...updated.data(),
    });
  } catch (error) {
    console.error("Update department failed:", error);
    return NextResponse.json(
      { error: "Failed to update department" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/departments
 * Delete a department. Requires superadmin.
 * Body: { id: string }
 */
export async function DELETE(request: NextRequest) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id } = body as { id?: string };

    if (!id) {
      return NextResponse.json(
        { error: "Department id is required" },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection("departments").doc(id);

    // Wrap entire delete in a transaction: read department doc (to get
    // final memberUids and to conflict with concurrent adds), clean up
    // user docs, then delete. Any concurrent addUids that touches this
    // department doc will cause the transaction to retry.
    // Check existence before transaction to return proper 404
    const existCheck = await docRef.get();
    if (!existCheck.exists) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 }
      );
    }

    await adminDb.runTransaction(async (tx) => {
      const doc = await tx.get(docRef);
      if (!doc.exists) {
        // Deleted between check and transaction start — no-op
        return;
      }

      const memberUids = (doc.data()?.memberUids as string[]) || [];

      // Read all member user docs inside the transaction
      const userRefs = memberUids.map((uid) =>
        adminDb.collection("users").doc(uid)
      );
      const userSnaps = userRefs.length > 0
        ? await tx.getAll(...userRefs)
        : [];

      // Only clear department if still pointing at this department
      for (let i = 0; i < userSnaps.length; i++) {
        if (userSnaps[i].data()?.department === id) {
          tx.update(userRefs[i], { department: FieldValue.delete() });
        }
      }

      tx.delete(docRef);
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("Delete department failed:", error);
    return NextResponse.json(
      { error: "Failed to delete department" },
      { status: 500 }
    );
  }
}
