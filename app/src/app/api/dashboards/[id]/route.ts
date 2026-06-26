import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";
import { deleteHtmlFile, deleteDashboardFiles } from "@/lib/storage";
import { FieldValue } from "firebase-admin/firestore";
import { generateSlug, reserveUniqueSlug, releaseSlug } from "@/lib/slug";
import { isValidCategory } from "@/lib/categories";
import { markForDeletion, finalizeDeleted, getInstance } from "@/lib/app-db/registry";
import { dropTablesWithPrefix } from "@/lib/app-db/schema-manager";
import { canViewDashboard, canViewDashboardViaSharedFolder } from "@/lib/permissions";

const SHARING_FIELDS = new Set(["visibility", "allowedEmails", "allowedDepartments"]);

async function getUserRoleAndDepartments(uid: string) {
  const [userDoc, deptSnap] = await Promise.all([
    adminDb.collection("users").doc(uid).get(),
    adminDb.collection("departments").where("memberUids", "array-contains", uid).get(),
  ]);

  return {
    role: userDoc.data()?.role as "user" | "admin" | "superadmin" | undefined,
    departmentIds: deptSnap.docs.map((doc) => doc.id),
  };
}

function onlyUpdatesSharingFields(body: Record<string, unknown>) {
  return Object.keys(body).every((key) => SHARING_FIELDS.has(key));
}

export async function GET(
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

    const data = doc.data()!;
    const { departmentIds } = await getUserRoleAndDepartments(auth.uid);
    const directAccess = canViewDashboard(
      {
        createdBy: data.createdBy,
        visibility: data.visibility,
        allowedEmails: Array.isArray(data.allowedEmails) ? data.allowedEmails : [],
        allowedDepartments: Array.isArray(data.allowedDepartments) ? data.allowedDepartments : [],
      },
      auth,
      departmentIds
    );
    const folderAccess = directAccess
      ? false
      : (await canViewDashboardViaSharedFolder(id, auth, adminDb)).allowed;

    if (!directAccess && !folderAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ id: doc.id, ...data });
  } catch (error) {
    console.error("Failed to get dashboard:", error);
    return NextResponse.json(
      { error: "Failed to get dashboard" },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    const isOwner = data?.createdBy === auth.uid;
    const body = await request.json();

    if (!isOwner) {
      const { role, departmentIds } = await getUserRoleAndDepartments(auth.uid);
      const isAdmin = role === "admin" || role === "superadmin";
      const hasDashboardAccess =
        canViewDashboard(
          {
            createdBy: data?.createdBy,
            visibility: data?.visibility,
            allowedEmails: Array.isArray(data?.allowedEmails) ? data.allowedEmails : [],
            allowedDepartments: Array.isArray(data?.allowedDepartments) ? data.allowedDepartments : [],
          },
          auth,
          departmentIds
        ) ||
        (await canViewDashboardViaSharedFolder(id, auth, adminDb)).allowed;

      if (!isAdmin || !hasDashboardAccess || !onlyUpdatesSharingFields(body)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.description !== undefined) updates.description = body.description?.trim() || null;
    if (body.category !== undefined && (await isValidCategory(body.category))) {
      updates.category = body.category;
    }
    if (body.visibility !== undefined) updates.visibility = body.visibility;
    if (body.allowedEmails !== undefined) updates.allowedEmails = body.allowedEmails;
    if (body.allowedDepartments !== undefined) updates.allowedDepartments = body.allowedDepartments;

    // Determine new slug (explicit slug > auto from title > keep current)
    const wantsNewSlug = body.slug !== undefined || (body.title !== undefined && !body.keepSlug);
    const oldSlug = data?.slug as string | undefined;
    let newSlug: string | undefined;

    if (body.slug !== undefined) {
      newSlug = body.slug;
    } else if (body.title !== undefined && !body.keepSlug) {
      newSlug = generateSlug(body.title.trim());
    }

    // Atomic: reserve slug + update doc in one transaction
    // Mirrors reserveUniqueSlug conflict resolution (0–19 suffix + timestamp fallback)
    if (newSlug && newSlug !== oldSlug) {
      const MAX_SUFFIX = 20;
      const reservedSlug = await adminDb.runTransaction(async (tx) => {
        // Build candidate list: base, base-2, base-3, ..., base-20
        const candidates: string[] = [];
        for (let i = 0; i < MAX_SUFFIX; i++) {
          candidates.push(i === 0 ? newSlug! : `${newSlug}-${i + 1}`);
        }

        // Try each candidate
        for (const candidate of candidates) {
          const slugRef = adminDb.collection("slugs").doc(candidate);
          const slugDoc = await tx.get(slugRef);
          if (!slugDoc.exists || slugDoc.data()?.dashboardId === id) {
            tx.set(slugRef, { dashboardId: id, reservedAt: new Date() });
            updates.slug = candidate;
            tx.update(adminDb.collection("dashboards").doc(id), updates);
            return candidate;
          }
        }

        // Timestamp fallback (matches reserveUniqueSlug behavior)
        const fallback = `${newSlug}-${Date.now().toString(36)}`;
        const fallbackRef = adminDb.collection("slugs").doc(fallback);
        tx.set(fallbackRef, { dashboardId: id, reservedAt: new Date() });
        updates.slug = fallback;
        tx.update(adminDb.collection("dashboards").doc(id), updates);
        return fallback;
      });

      // Release old slug AFTER transaction succeeds
      if (oldSlug && oldSlug !== reservedSlug) {
        await releaseSlug(oldSlug);
      }
    } else {
      // No slug change — simple update
      await adminDb.collection("dashboards").doc(id).update(updates);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update dashboard:", error);
    return NextResponse.json(
      { error: "Failed to update dashboard" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Delete Firestore doc FIRST (authoritative record)
    await adminDb.collection("dashboards").doc(id).delete();

    // Release slug AFTER doc is gone (safe: slug points to deleted doc)
    if (data?.slug) {
      await releaseSlug(data.slug).catch((err) =>
        console.warn(`[Delete] Failed to release slug ${data.slug}:`, err)
      );
    }

    // Delete file(s) from GCS LAST (orphan file is harmless, missing file is not)
    if (data?.isMultiPage && data?.createdBy) {
      // Multi-page: delete all files under the stable dashboard prefix
      const storagePrefix = `dashboards/${data.createdBy}/${id}/`;
      await deleteDashboardFiles(storagePrefix).catch((err) =>
        console.warn(`[Delete] Failed to delete GCS files under ${storagePrefix}:`, err)
      );
    } else if (data?.storagePath) {
      await deleteHtmlFile(data.storagePath).catch((err) =>
        console.warn(`[Delete] Failed to delete GCS file ${data.storagePath}:`, err)
      );
    }

    // Clean up Postgres field data (best-effort, after Firestore delete)
    try {
      const { prisma } = await import("@/lib/prisma");
      // Cascade delete handles values, but we need to clean audit too
      await prisma.dashboardFieldAudit.deleteMany({ where: { dashboardId: id } });
      await prisma.dashboardFieldSchema.deleteMany({ where: { dashboardId: id } });
    } catch (err) {
      console.warn(`[Delete] Failed to clean up Postgres field data:`, err);
    }

    // Clean up app database tables and registry (best-effort)
    try {
      const dbInstance = await getInstance(id);
      if (dbInstance) {
        await markForDeletion(id);
        try {
          const dropped = await dropTablesWithPrefix(dbInstance.userSchema, dbInstance.tablePrefix);
          if (dropped.length > 0) {
            console.log(`[Delete] Dropped ${dropped.length} app-db tables for dashboard ${id}`);
          }
          await finalizeDeleted(id);
        } catch (dropErr) {
          // Drop failed but Firestore doc is already gone.
          // Leave in "deleting" state — the orphan scanner will retry later.
          console.warn(`[Delete] Table drop failed for ${id}, left in deleting state:`, dropErr);
        }
      }
    } catch (err) {
      console.warn(`[Delete] Failed to clean up app database for ${id}:`, err);
    }

    // Clean up folder references across all users (best-effort)
    // Firestore batches are limited to 500 writes, so we chunk.
    try {
      const { FieldValue } = await import("firebase-admin/firestore");
      const foldersSnap = await adminDb.collectionGroup("folders")
        .where("dashboardIds", "array-contains", id)
        .get();
      if (!foldersSnap.empty) {
        const BATCH_LIMIT = 500;
        const docs = foldersSnap.docs;
        for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
          const batch = adminDb.batch();
          const chunk = docs.slice(i, i + BATCH_LIMIT);
          for (const folderDoc of chunk) {
            batch.update(folderDoc.ref, {
              dashboardIds: FieldValue.arrayRemove(id),
            });
          }
          await batch.commit();
        }
      }
    } catch (err) {
      console.warn(`[Delete] Failed to clean folder refs for ${id}:`, err);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete dashboard:", error);
    return NextResponse.json(
      { error: "Failed to delete dashboard" },
      { status: 500 }
    );
  }
}
