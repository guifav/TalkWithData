import { NextRequest, NextResponse } from "next/server";
import { verifyRequest, verifySuperAdmin } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";
import { getCategories } from "@/lib/categories";

const SETTINGS_DOC = "settings/categories";
const PROTECTED_CATEGORY = "Other";

/** Split array into chunks of given size (for Firestore 500-write batch limit) */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * GET /api/admin/categories
 * Returns list of categories. Any authenticated user can read.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const categories = await getCategories();
    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Failed to get categories:", error);
    return NextResponse.json(
      { error: "Failed to load categories" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/categories
 * Superadmin only. Manage categories.
 * Body: { action: "add" | "rename" | "remove", name: string, newName?: string }
 */
export async function PATCH(request: NextRequest) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { action, name, newName } = body as {
      action?: string;
      name?: string;
      newName?: string;
    };

    if (!action || !name?.trim()) {
      return NextResponse.json(
        { error: "Required: action (add|rename|remove), name" },
        { status: 400 }
      );
    }

    const categories = await getCategories();
    const trimmedName = name.trim();

    switch (action) {
      case "add": {
        if (categories.includes(trimmedName)) {
          return NextResponse.json(
            { error: `Category "${trimmedName}" already exists` },
            { status: 400 }
          );
        }
        // Insert before "Other" (keep Other last)
        const otherIdx = categories.indexOf(PROTECTED_CATEGORY);
        const updated = [...categories];
        if (otherIdx >= 0) {
          updated.splice(otherIdx, 0, trimmedName);
        } else {
          updated.push(trimmedName);
        }
        await adminDb.doc(SETTINGS_DOC).update({ items: updated });
        return NextResponse.json({ categories: updated });
      }

      case "rename": {
        if (!newName?.trim()) {
          return NextResponse.json(
            { error: "newName is required for rename" },
            { status: 400 }
          );
        }
        if (trimmedName === PROTECTED_CATEGORY) {
          return NextResponse.json(
            { error: `Cannot rename "${PROTECTED_CATEGORY}"` },
            { status: 400 }
          );
        }
        if (!categories.includes(trimmedName)) {
          return NextResponse.json(
            { error: `Category "${trimmedName}" not found` },
            { status: 404 }
          );
        }
        const trimmedNew = newName.trim();
        if (categories.includes(trimmedNew)) {
          return NextResponse.json(
            { error: `Category "${trimmedNew}" already exists` },
            { status: 400 }
          );
        }

        // Migrate dashboards FIRST (before updating category list)
        // so a failure here doesn't orphan data
        const dashSnap = await adminDb
          .collection("dashboards")
          .where("category", "==", trimmedName)
          .get();
        if (!dashSnap.empty) {
          // Firestore batch limit is 500 writes — chunk accordingly
          const chunks = chunkArray(dashSnap.docs, 500);
          for (const chunk of chunks) {
            const batch = adminDb.batch();
            for (const doc of chunk) {
              batch.update(doc.ref, { category: trimmedNew });
            }
            await batch.commit();
          }
        }

        // Update category list only after dashboards are migrated
        const updated = categories.map((c) =>
          c === trimmedName ? trimmedNew : c
        );
        await adminDb.doc(SETTINGS_DOC).update({ items: updated });

        return NextResponse.json({
          categories: updated,
          dashboardsUpdated: dashSnap.size,
        });
      }

      case "remove": {
        if (trimmedName === PROTECTED_CATEGORY) {
          return NextResponse.json(
            { error: `Cannot remove "${PROTECTED_CATEGORY}"` },
            { status: 400 }
          );
        }
        if (!categories.includes(trimmedName)) {
          return NextResponse.json(
            { error: `Category "${trimmedName}" not found` },
            { status: 404 }
          );
        }

        // Reclassify dashboards FIRST (before removing from list)
        const dashSnap = await adminDb
          .collection("dashboards")
          .where("category", "==", trimmedName)
          .get();
        if (!dashSnap.empty) {
          const chunks = chunkArray(dashSnap.docs, 500);
          for (const chunk of chunks) {
            const batch = adminDb.batch();
            for (const doc of chunk) {
              batch.update(doc.ref, { category: PROTECTED_CATEGORY });
            }
            await batch.commit();
          }
        }

        // Remove from list only after dashboards are migrated
        const updated = categories.filter((c) => c !== trimmedName);
        await adminDb.doc(SETTINGS_DOC).update({ items: updated });

        return NextResponse.json({
          categories: updated,
          dashboardsReclassified: dashSnap.size,
        });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action. Use: add, rename, remove" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Category management failed:", error);
    return NextResponse.json(
      { error: "Failed to update categories" },
      { status: 500 }
    );
  }
}
