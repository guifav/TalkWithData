import { adminDb } from "@/lib/firebase/admin";
import { adminStorage } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

const MAX_VERSIONS = 10;
const BUCKET_NAME = "gri-dashs-uploads";

/**
 * Archive the current live dashboard file as a version before replacing/restoring.
 * Copies the file to a versioned GCS path and creates a version metadata doc.
 * Enforces MAX_VERSIONS limit with FIFO cleanup.
 *
 * @param protectVersionId - If provided, this version doc ID will NOT be deleted
 *   during FIFO cleanup (used by restore to protect the version being restored).
 */
export async function archiveCurrentVersion(
  dashboardId: string,
  data: Record<string, unknown>,
  replacedBy: { uid: string; email: string },
  protectVersionId?: string
): Promise<void> {
  const versionsRef = adminDb
    .collection("dashboards")
    .doc(dashboardId)
    .collection("versions");

  // Get existing versions to determine next version number
  const existing = await versionsRef.orderBy("replacedAt", "asc").get();

  // Derive nextVersion from highest existing versionNumber (not size)
  // to avoid collisions after FIFO cleanup deletes old entries
  let maxVersion = 0;
  for (const doc of existing.docs) {
    const vNum = doc.data().versionNumber;
    if (typeof vNum === "number" && vNum > maxVersion) {
      maxVersion = vNum;
    }
  }
  const nextVersion = maxVersion + 1;

  // Copy current live file to versioned path in GCS
  const oldStoragePath = data.storagePath as string;
  const versionedPath = `versions/${dashboardId}/${nextVersion}/${data.fileName}`;

  const bucket = adminStorage.bucket(BUCKET_NAME);
  const oldFile = bucket.file(oldStoragePath);

  try {
    await oldFile.copy(bucket.file(versionedPath));
  } catch (err) {
    console.error(
      `[Version] Failed to archive ${oldStoragePath} → ${versionedPath}:`,
      err
    );
    // Abort — proceeding without a successful archive would lose the live file
    throw new Error(
      `Failed to archive current version: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Save version metadata
  await versionsRef.doc(String(nextVersion)).set({
    versionNumber: nextVersion,
    storagePath: versionedPath,
    fileName: data.fileName,
    fileSizeBytes: data.fileSizeBytes,
    replacedAt: FieldValue.serverTimestamp(),
    replacedBy: replacedBy.uid,
    replacedByEmail: replacedBy.email,
  });

  // Cleanup: if we exceed MAX_VERSIONS, delete the oldest
  // (skip protectVersionId to avoid deleting a version mid-restore)
  if (existing.size >= MAX_VERSIONS) {
    const toDelete = existing.docs
      .filter((doc) => doc.id !== protectVersionId)
      .slice(0, existing.size - MAX_VERSIONS + 1);

    for (const vDoc of toDelete) {
      const vData = vDoc.data();
      if (vData.storagePath) {
        await bucket
          .file(vData.storagePath)
          .delete({ ignoreNotFound: true })
          .catch(() => {});
      }
      await vDoc.ref.delete().catch(() => {});
    }
  }
}
