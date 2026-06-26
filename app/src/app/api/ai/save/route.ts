import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";
import { uploadHtmlFile } from "@/lib/storage";
import { FieldValue } from "firebase-admin/firestore";
import { generateSlug, reserveUniqueSlug, releaseSlug } from "@/lib/slug";
import { isValidCategory } from "@/lib/categories";
import { extractTextFromHtml, MAX_SEARCHABLE_TEXT } from "@/lib/html-text";
import { archiveCurrentVersion } from "@/lib/versions";
import { triggerThumbnailGeneration } from "@/lib/thumbnail";
import { activateInstance, getInstanceWithTables, buildFirestoreSummary } from "@/lib/app-db/registry";
import { checkUserHasMcpAccess } from "@/lib/mcp-access";
import { resolveUserModel } from "@/lib/ai-model";
import type { AiRecipe } from "@/lib/types";

interface SaveBody {
  dashboardId?: string;
  draftDashboardId?: string; // pre-allocated ID from provision-draft
  title: string;
  description?: string;
  html: string;
  category?: string;
  visibility?: "team" | "specific";
  allowedEmails?: string[];
  aiRecipe?: AiRecipe;
  messages?: unknown[];
  parsedFiles?: Array<{ name: string; type: string; summary: string; content: string }>;
}

export async function POST(request: NextRequest) {
  const auth = await verifyRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify user has MCP access (any user with MCP access can save, not just superadmin)
  const hasMcp = await checkUserHasMcpAccess(auth.uid);
  if (!hasMcp) {
    return NextResponse.json(
      { error: "MCP access required to save AI dashboards" },
      { status: 403 }
    );
  }

  try {
    const body = (await request.json()) as SaveBody;
    const { dashboardId, draftDashboardId, title, description, html, category: categoryRaw, aiRecipe, messages, parsedFiles, visibility: visRaw, allowedEmails: emailsRaw } = body;

    if (!title?.trim() || !html) {
      return NextResponse.json(
        { error: "title and html are required" },
        { status: 400 }
      );
    }

    // ── UPDATE MODE ──────────────────────────────────────────────────
    if (dashboardId) {
      return await handleUpdate(dashboardId, auth, { title, description, html, categoryRaw, aiRecipe, messages, parsedFiles, draftDashboardId });
    }

    // ── CREATE MODE ──────────────────────────────────────────────────
    const category =
      categoryRaw && (await isValidCategory(categoryRaw))
        ? categoryRaw
        : "Other";

    // Use pre-allocated draftDashboardId if provided, otherwise generate new
    let validatedDraftId: string | undefined;
    if (draftDashboardId) {
      // Validate ownership: the draft instance must belong to the authenticated user
      const { getInstance } = await import("@/lib/app-db/registry");
      const draftInstance = await getInstance(draftDashboardId);
      if (!draftInstance || draftInstance.ownerUid !== auth.uid) {
        return NextResponse.json(
          { error: "Invalid or unauthorized draft dashboard" },
          { status: 403 }
        );
      }
      // Reject expired/cleaned drafts — only draft or active instances can be saved
      if (draftInstance.status !== "draft" && draftInstance.status !== "active") {
        return NextResponse.json(
          { error: `Database scope is no longer usable (status: ${draftInstance.status}). Please start a new app.` },
          { status: 410 }
        );
      }
      // Ensure no Firestore doc already exists (prevent overwrite/hijack)
      const existingDoc = await adminDb.collection("dashboards").doc(draftDashboardId).get();
      if (existingDoc.exists) {
        return NextResponse.json(
          { error: "Dashboard already exists. Use update mode instead." },
          { status: 409 }
        );
      }
      validatedDraftId = draftDashboardId;
    }

    const docRef = validatedDraftId
      ? adminDb.collection("dashboards").doc(validatedDraftId)
      : adminDb.collection("dashboards").doc();
    const newId = docRef.id;

    const buffer = Buffer.from(html, "utf-8");
    const fileName = `${generateSlug(title.trim())}.html`;
    const searchableText = extractTextFromHtml(html).slice(
      0,
      MAX_SEARCHABLE_TEXT
    );

    // Phase 1: Upload HTML to GCS
    const storagePath = await uploadHtmlFile(
      auth.uid,
      newId,
      fileName,
      buffer
    );

    // Phase 2: Reserve slug
    let slug: string | undefined;
    try {
      slug = await reserveUniqueSlug(generateSlug(title.trim()), newId);
    } catch (err) {
      const { deleteHtmlFile } = await import("@/lib/storage");
      await deleteHtmlFile(storagePath).catch(() => {});
      throw err;
    }

    // Phase 3: Create Firestore doc
    try {
      const docData: Record<string, unknown> = {
        slug,
        title: title.trim(),
        description: description?.trim() || null,
        fileName,
        storagePath,
        fileSizeBytes: buffer.length,
        thumbnailUrl: null,
        thumbnailUpdatedAt: null,
        thumbnailStoragePath: null,
        thumbnailContentType: null,
        category,
        visibility: visRaw === "specific" ? "specific" : "team",
        allowedEmails:
          visRaw === "specific" && Array.isArray(emailsRaw)
            ? emailsRaw.map((e: string) => e.trim().toLowerCase()).filter(Boolean)
            : [],
        createdBy: auth.uid,
        createdByEmail: auth.email,
        createdByName: auth.name || auth.email,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        viewCount: 0,
        lastViewedAt: null,
        archivedAt: null,
        archivedBy: null,
        searchableText,
        source: "ai",
      };

      if (aiRecipe) {
        // Persist the AI model used for this dashboard (for refresh reproducibility)
        try {
          const userModel = await resolveUserModel(auth.uid);
          docData.aiRecipe = {
            ...aiRecipe,
            provider: userModel.config.provider,
            model: userModel.config.model,
          };
        } catch {
          docData.aiRecipe = aiRecipe;
        }
      }

      // Write the dashboard doc first (without appDatabase — set after activation)
      await docRef.set(docData);

      // Activate AFTER Firestore write succeeds (prevents orphaned active instances)
      if (validatedDraftId) {
        try {
          await activateInstance(validatedDraftId);
          // Rebuild summary from the now-active instance and sync to Firestore
          const activatedInstance = await getInstanceWithTables(validatedDraftId);
          if (activatedInstance) {
            await docRef.update({ appDatabase: buildFirestoreSummary(activatedInstance) });
          }
        } catch (dbErr) {
          console.error("[AI Save] Failed to activate/sync app database (dashboard exists, instance may stay draft):", dbErr);
        }
      }
    } catch (err) {
      await releaseSlug(slug).catch(() => {});
      const { deleteHtmlFile } = await import("@/lib/storage");
      await deleteHtmlFile(storagePath).catch(() => {});
      throw err;
    }

    // Phase 4: Save conversation (best-effort — dashboard already persisted)
    if (messages && Array.isArray(messages) && messages.length > 0) {
      try {
        await docRef
          .collection("conversations")
          .doc("main")
          .set({
            messages,
            ...(parsedFiles && parsedFiles.length > 0 ? { parsedFiles } : {}),
            updatedAt: new Date().toISOString(),
          });
      } catch (convErr) {
        console.error("[AI Save] Conversation save failed (dashboard already created):", convErr);
      }
    }

    // Fire-and-forget thumbnail generation
    triggerThumbnailGeneration(newId);

    return NextResponse.json({ id: newId, slug, storagePath });
  } catch (error) {
    console.error("[AI Save] Error:", error);
    return NextResponse.json(
      { error: "Failed to save dashboard" },
      { status: 500 }
    );
  }
}

// ── UPDATE EXISTING AI DASHBOARD ──────────────────────────────────────────

async function handleUpdate(
  dashboardId: string,
  auth: { uid: string; email: string; name?: string },
  opts: {
    title: string;
    description?: string;
    html: string;
    categoryRaw?: string;
    aiRecipe?: AiRecipe;
    messages?: unknown[];
    parsedFiles?: Array<{ name: string; type: string; summary: string; content: string }>;
    draftDashboardId?: string;
  }
) {
  const { title, description, html, aiRecipe, messages } = opts;

  const docRef = adminDb.collection("dashboards").doc(dashboardId);
  const doc = await docRef.get();

  if (!doc.exists) {
    return NextResponse.json({ error: "Dashboard not found" }, { status: 404 });
  }

  const data = doc.data()!;

  // Must be an AI dashboard
  if (data.source !== "ai") {
    return NextResponse.json(
      { error: "Only AI dashboards can be updated via this endpoint" },
      { status: 400 }
    );
  }

  // Must be the dashboard owner
  if (data.createdBy !== auth.uid) {
    return NextResponse.json(
      { error: "Only the dashboard owner can edit it" },
      { status: 403 }
    );
  }

  // Archive current version before overwriting
  if (data.storagePath) {
    await archiveCurrentVersion(
      dashboardId,
      data as Record<string, unknown>,
      { uid: auth.uid, email: auth.email }
    );
  }

  // Upload new HTML (overwrite same path pattern)
  const buffer = Buffer.from(html, "utf-8");
  const fileName = data.fileName as string;
  const storagePath = await uploadHtmlFile(
    data.createdBy as string,
    dashboardId,
    fileName,
    buffer
  );

  const searchableText = extractTextFromHtml(html).slice(0, MAX_SEARCHABLE_TEXT);

  // Update Firestore doc
  const updates: Record<string, unknown> = {
    storagePath,
    fileSizeBytes: buffer.length,
    searchableText,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (aiRecipe) {
    // Preserve the saved model from the existing aiRecipe if not provided
    const existingModel = (data.aiRecipe as Record<string, unknown> | undefined)?.model;
    if (!aiRecipe.model && existingModel) {
      aiRecipe.model = existingModel as string;
    }
    // Inject current user's model if still missing
    if (!aiRecipe.model) {
      try {
        const userModel = await resolveUserModel(auth.uid);
        aiRecipe.provider = userModel.config.provider;
        aiRecipe.model = userModel.config.model;
      } catch { /* use without model */ }
    }
    updates.aiRecipe = aiRecipe;
  }

  await docRef.update(updates);

  // Update conversation (best-effort)
  if (messages && Array.isArray(messages) && messages.length > 0) {
    try {
      await docRef
        .collection("conversations")
        .doc("main")
        .set({
          messages,
          ...(opts.parsedFiles && opts.parsedFiles.length > 0 ? { parsedFiles: opts.parsedFiles } : {}),
          updatedAt: new Date().toISOString(),
        });
    } catch (convErr) {
      console.error("[AI Save Update] Conversation save failed:", convErr);
    }
  }

  // Activate app-db if a new draft was provisioned during this edit session.
  // The draft was provisioned under a temp ID — re-key it to the real dashboard ID
  // so that db-context, edit sessions, and deletion all find it correctly.
  if (opts.draftDashboardId && opts.draftDashboardId !== dashboardId) {
    try {
      const { getInstance, rekeyInstance } = await import("@/lib/app-db/registry");
      const draftInstance = await getInstance(opts.draftDashboardId);
      if (draftInstance && draftInstance.ownerUid === auth.uid &&
          (draftInstance.status === "draft" || draftInstance.status === "active")) {
        // Re-key from draft ID to real dashboard ID
        await rekeyInstance(opts.draftDashboardId, dashboardId);
        await activateInstance(dashboardId);
        const activated = await getInstanceWithTables(dashboardId);
        if (activated) {
          await docRef.update({ appDatabase: buildFirestoreSummary(activated) });
        }
      }
    } catch (dbErr) {
      console.error("[AI Save Update] Failed to activate app database:", dbErr);
    }
  } else if (opts.draftDashboardId) {
    // Draft ID === dashboard ID (shouldn't happen in edit mode, but handle gracefully)
    try {
      await activateInstance(dashboardId);
      const activated = await getInstanceWithTables(dashboardId);
      if (activated) {
        await docRef.update({ appDatabase: buildFirestoreSummary(activated) });
      }
    } catch (dbErr) {
      console.error("[AI Save Update] Failed to activate app database:", dbErr);
    }
  }

  // Fire-and-forget thumbnail generation
  triggerThumbnailGeneration(dashboardId);

  return NextResponse.json({
    id: dashboardId,
    slug: data.slug,
    storagePath,
  });
}

// checkUserHasMcpAccess imported from @/lib/mcp-access
