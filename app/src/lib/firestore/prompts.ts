/**
 * Firestore CRUD for versioned app prompts.
 *
 * Layout:
 *   app_prompts/{promptKey}                    summary doc
 *     ├─ key, label, description
 *     ├─ activeVersion (number | null)
 *     ├─ activeContent (string)                denormalized for fast reads
 *     ├─ updatedAt, updatedBy { uid, email, name }
 *     ├─ draftContent (string)                 current working draft
 *     ├─ draftUpdatedAt, draftUpdatedBy
 *     │
 *     └─ versions/{versionId}                  immutable history
 *         ├─ version (number, auto-increment)
 *         ├─ content (string)
 *         ├─ status: "active" | "archived"
 *         ├─ changeSummary (string, max 500)
 *         ├─ authorUid, authorEmail, authorName
 *         ├─ createdAt (server timestamp)
 *         └─ restoredFromVersion (number | null)
 *
 * Issue #164
 */
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import {
  PROMPT_CATALOG,
  type PromptKey,
  getCatalogEntry,
  invalidatePromptCache,
  validatePromptContent,
  type PromptGlobalVariable,
  type PromptGovernance,
} from "@/lib/prompt-registry";
import type { AuthResult } from "@/lib/api-auth";

const COLLECTION = "app_prompts";
const VERSIONS = "versions";
const MAX_SUMMARY_LEN = 500;

export interface PromptAuthor {
  uid: string;
  email: string;
  name?: string;
}

export interface PromptVersion {
  id: string;
  version: number;
  content: string;
  status: "active" | "archived";
  changeSummary: string;
  authorUid: string;
  authorEmail: string;
  authorName?: string;
  createdAt: string;
  restoredFromVersion: number | null;
}

export interface PromptSummary {
  key: PromptKey;
  label: string;
  description: string;
  governance: PromptGovernance;
  globalVariables: PromptGlobalVariable[];
  requiredPlaceholders: string[];
  activeVersion: number | null;
  hasFallback: true;
  hasActive: boolean;
  hasDraft: boolean;
  updatedAt: string | null;
  updatedBy: PromptAuthor | null;
  draftUpdatedAt: string | null;
  draftUpdatedBy: PromptAuthor | null;
  isTemplate: boolean;
}

export interface PromptDetail extends PromptSummary {
  activeContent: string | null;
  draftContent: string | null;
  fallbackContent: string;
}

function toAuthor(auth: AuthResult): PromptAuthor {
  const a: PromptAuthor = { uid: auth.uid, email: auth.email };
  if (auth.name) a.name = auth.name;
  return a;
}

function tsToIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
}

export function validateChangeSummary(summary: unknown): summary is string {
  return (
    typeof summary === "string" &&
    summary.trim().length > 0 &&
    summary.length <= MAX_SUMMARY_LEN
  );
}

export function validateContent(content: unknown): content is string {
  return typeof content === "string" && content.trim().length > 0;
}

/** Returns the summary for every catalog prompt, even those with no Firestore doc yet. */
export async function listPromptSummaries(): Promise<PromptSummary[]> {
  const docs = await Promise.all(
    PROMPT_CATALOG.map((entry) =>
      adminDb.collection(COLLECTION).doc(entry.key).get()
    )
  );

  return PROMPT_CATALOG.map((entry, idx) => {
    const data = docs[idx].data();
    return {
      key: entry.key,
      label: entry.label,
      description: entry.description,
      governance: entry.governance,
      globalVariables: entry.globalVariables,
      requiredPlaceholders: entry.requiredPlaceholders ?? [],
      activeVersion:
        typeof data?.activeVersion === "number" ? data.activeVersion : null,
      hasFallback: true,
      hasActive: typeof data?.activeContent === "string",
      hasDraft: typeof data?.draftContent === "string",
      updatedAt: tsToIso(data?.updatedAt),
      updatedBy: (data?.updatedBy as PromptAuthor | undefined) ?? null,
      draftUpdatedAt: tsToIso(data?.draftUpdatedAt),
      draftUpdatedBy:
        (data?.draftUpdatedBy as PromptAuthor | undefined) ?? null,
      isTemplate: !!entry.isTemplate,
    } satisfies PromptSummary;
  });
}

export async function getPromptDetail(
  key: PromptKey
): Promise<PromptDetail> {
  const entry = getCatalogEntry(key);
  const doc = await adminDb.collection(COLLECTION).doc(key).get();
  const data = doc.data();

  return {
    key,
    label: entry.label,
    description: entry.description,
    governance: entry.governance,
    globalVariables: entry.globalVariables,
    requiredPlaceholders: entry.requiredPlaceholders ?? [],
    activeVersion:
      typeof data?.activeVersion === "number" ? data.activeVersion : null,
    hasFallback: true,
    hasActive: typeof data?.activeContent === "string",
    hasDraft: typeof data?.draftContent === "string",
    updatedAt: tsToIso(data?.updatedAt),
    updatedBy: (data?.updatedBy as PromptAuthor | undefined) ?? null,
    draftUpdatedAt: tsToIso(data?.draftUpdatedAt),
    draftUpdatedBy:
      (data?.draftUpdatedBy as PromptAuthor | undefined) ?? null,
    isTemplate: !!entry.isTemplate,
    activeContent:
      typeof data?.activeContent === "string" ? data.activeContent : null,
    draftContent:
      typeof data?.draftContent === "string" ? data.draftContent : null,
    fallbackContent: entry.fallback,
  };
}

export async function listPromptVersions(
  key: PromptKey
): Promise<PromptVersion[]> {
  const snap = await adminDb
    .collection(COLLECTION)
    .doc(key)
    .collection(VERSIONS)
    .orderBy("version", "desc")
    .get();

  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      version: d.version as number,
      content: d.content as string,
      status: d.status as "active" | "archived",
      changeSummary: d.changeSummary as string,
      authorUid: d.authorUid as string,
      authorEmail: d.authorEmail as string,
      authorName: d.authorName as string | undefined,
      createdAt: tsToIso(d.createdAt) ?? new Date(0).toISOString(),
      restoredFromVersion:
        typeof d.restoredFromVersion === "number"
          ? d.restoredFromVersion
          : null,
    } satisfies PromptVersion;
  });
}

export async function getPromptVersion(
  key: PromptKey,
  versionId: string
): Promise<PromptVersion | null> {
  const doc = await adminDb
    .collection(COLLECTION)
    .doc(key)
    .collection(VERSIONS)
    .doc(versionId)
    .get();
  if (!doc.exists) return null;
  const d = doc.data();
  if (!d) return null;
  return {
    id: doc.id,
    version: d.version as number,
    content: d.content as string,
    status: d.status as "active" | "archived",
    changeSummary: d.changeSummary as string,
    authorUid: d.authorUid as string,
    authorEmail: d.authorEmail as string,
    authorName: d.authorName as string | undefined,
    createdAt: tsToIso(d.createdAt) ?? new Date(0).toISOString(),
    restoredFromVersion:
      typeof d.restoredFromVersion === "number"
        ? d.restoredFromVersion
        : null,
  };
}

export async function saveDraft(
  key: PromptKey,
  content: string,
  author: AuthResult
): Promise<void> {
  const entry = getCatalogEntry(key);
  const docRef = adminDb.collection(COLLECTION).doc(key);
  await docRef.set(
    {
      key,
      label: entry.label,
      description: entry.description,
      draftContent: content,
      draftUpdatedAt: FieldValue.serverTimestamp(),
      draftUpdatedBy: toAuthor(author),
    },
    { merge: true }
  );
}

export async function discardDraft(key: PromptKey): Promise<void> {
  const docRef = adminDb.collection(COLLECTION).doc(key);
  await docRef.set(
    {
      draftContent: FieldValue.delete(),
      draftUpdatedAt: FieldValue.delete(),
      draftUpdatedBy: FieldValue.delete(),
    },
    { merge: true }
  );
}

interface PublishOptions {
  restoredFromVersion?: number;
}

/**
 * Publish a new active version. Runs in a transaction:
 *   1. Read current `activeVersion` from summary doc.
 *   2. Mark the previous active version (if any) as archived.
 *   3. Create a new versions/{n+1} doc with status="active".
 *   4. Update summary doc with new activeVersion, activeContent.
 *   5. Clear any draft.
 *
 * Returns the new version number.
 */
export async function publishVersion(
  key: PromptKey,
  content: string,
  changeSummary: string,
  author: AuthResult,
  options: PublishOptions = {}
): Promise<{ version: number; versionId: string }> {
  const entry = getCatalogEntry(key);
  const docRef = adminDb.collection(COLLECTION).doc(key);
  const versionsRef = docRef.collection(VERSIONS);

  const result = await adminDb.runTransaction(async (tx) => {
    const summarySnap = await tx.get(docRef);
    const summary = summarySnap.data() || {};
    const currentVersion =
      typeof summary.activeVersion === "number" ? summary.activeVersion : 0;
    const nextVersion = currentVersion + 1;

    // Archive previous active, if any
    if (currentVersion > 0) {
      const prevQuery = await tx.get(
        versionsRef.where("version", "==", currentVersion).limit(1)
      );
      if (!prevQuery.empty) {
        tx.update(prevQuery.docs[0].ref, { status: "archived" });
      }
    }

    const newVersionRef = versionsRef.doc();
    const versionPayload: Record<string, unknown> = {
      version: nextVersion,
      content,
      status: "active",
      changeSummary: changeSummary.trim(),
      authorUid: author.uid,
      authorEmail: author.email,
      createdAt: FieldValue.serverTimestamp(),
      restoredFromVersion:
        typeof options.restoredFromVersion === "number"
          ? options.restoredFromVersion
          : null,
    };
    if (author.name) versionPayload.authorName = author.name;
    tx.set(newVersionRef, versionPayload);

    tx.set(
      docRef,
      {
        key,
        label: entry.label,
        description: entry.description,
        activeVersion: nextVersion,
        activeContent: content,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: toAuthor(author),
        draftContent: FieldValue.delete(),
        draftUpdatedAt: FieldValue.delete(),
        draftUpdatedBy: FieldValue.delete(),
      },
      { merge: true }
    );

    return { version: nextVersion, versionId: newVersionRef.id };
  });

  invalidatePromptCache(key);
  return result;
}

/** Restores a previous version by publishing a NEW active version with its content. */
export async function restoreVersion(
  key: PromptKey,
  sourceVersionId: string,
  changeSummary: string,
  author: AuthResult
): Promise<{ version: number; versionId: string }> {
  const source = await getPromptVersion(key, sourceVersionId);
  if (!source) {
    throw new Error("Source version not found");
  }
  const { missingPlaceholders, unknownVariables } = validatePromptContent(
    key,
    source.content
  );
  if (missingPlaceholders.length > 0 || unknownVariables.length > 0) {
    throw new Error("Source version failed prompt content validation");
  }
  return publishVersion(key, source.content, changeSummary, author, {
    restoredFromVersion: source.version,
  });
}
