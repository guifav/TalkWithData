import { adminStorage } from "@/lib/firebase/admin";
import AdmZip from "adm-zip";

const BUCKET_NAME = "example-uploads";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per single file
const MAX_ZIP_SIZE = 50 * 1024 * 1024; // 50MB for ZIP packages
const MAX_ZIP_FILES = 200; // max files inside a ZIP
const MAX_EXTRACTED_SIZE = 200 * 1024 * 1024; // 200MB total uncompressed limit

/** Content-type mapping for common dashboard asset extensions. */
const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".htm": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
};

/** Infer content type from file extension. */
export function getContentType(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  return CONTENT_TYPES[ext] || "application/octet-stream";
}

// ── Single-file upload (existing) ───────────────────────────────────────────

export async function uploadHtmlFile(
  userId: string,
  dashboardId: string,
  fileName: string,
  buffer: Buffer
): Promise<string> {
  if (!fileName.endsWith(".html")) {
    throw new Error("Only .html files are allowed");
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error("File size exceeds 10MB limit");
  }

  const storagePath = `dashboards/${userId}/${dashboardId}/${fileName}`;
  const bucket = adminStorage.bucket(BUCKET_NAME);
  const file = bucket.file(storagePath);

  await file.save(buffer, {
    contentType: "text/html",
    metadata: {
      cacheControl: "public, max-age=3600",
    },
  });

  return storagePath;
}

export async function getHtmlFile(storagePath: string): Promise<Buffer> {
  const bucket = adminStorage.bucket(BUCKET_NAME);
  const file = bucket.file(storagePath);
  const [contents] = await file.download();
  return contents;
}

export async function deleteHtmlFile(storagePath: string): Promise<void> {
  const bucket = adminStorage.bucket(BUCKET_NAME);
  const file = bucket.file(storagePath);
  await file.delete({ ignoreNotFound: true });
}

// ── ZIP / multi-page upload ─────────────────────────────────────────────────

export interface ZipUploadResult {
  /** GCS prefix where all files were uploaded: dashboards/{userId}/{dashboardId}/ */
  storagePrefix: string;
  /** storagePath of the entrypoint file (index.html by default). Used as the Dashboard.storagePath. */
  storagePath: string;
  /** Entrypoint relative path (e.g. "index.html"). */
  entrypoint: string;
  /** All relative file paths inside the package. */
  files: string[];
  /** Total size of all extracted files. */
  totalSizeBytes: number;
}

/**
 * Validate a relative path is safe (no directory traversal, no absolute paths,
 * no hidden dirs, no empty segments).
 */
function isPathSafe(relativePath: string): boolean {
  if (!relativePath || relativePath.startsWith("/") || relativePath.startsWith("\\")) {
    return false;
  }
  const segments = relativePath.split(/[/\\]/);
  for (const seg of segments) {
    if (seg === ".." || seg === "." || seg === "" || seg.startsWith(".")) {
      return false;
    }
  }
  return true;
}

/**
 * Extract and upload a ZIP package to GCS. Returns metadata about the uploaded files.
 *
 * @param userId        - Firebase UID of the uploader
 * @param dashboardId   - Firestore doc ID for the dashboard
 * @param zipBuffer     - Raw ZIP file contents
 * @param entrypoint    - Which file inside the ZIP is the entrypoint (default "index.html")
 */
export async function uploadZipDashboard(
  userId: string,
  dashboardId: string,
  zipBuffer: Buffer,
  entrypoint: string = "index.html"
): Promise<ZipUploadResult> {
  if (zipBuffer.length > MAX_ZIP_SIZE) {
    throw new Error(`ZIP file exceeds ${MAX_ZIP_SIZE / 1024 / 1024}MB limit`);
  }

  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  // Filter to real files (not directories), validate paths
  const validEntries = entries.filter((e) => {
    if (e.isDirectory) return false;
    const path = e.entryName.replace(/\\/g, "/");
    return isPathSafe(path);
  });

  if (validEntries.length === 0) {
    throw new Error("ZIP file contains no valid files");
  }

  if (validEntries.length > MAX_ZIP_FILES) {
    throw new Error(`ZIP file contains too many files (max ${MAX_ZIP_FILES})`);
  }

  // Pre-flight: check declared uncompressed sizes from ZIP headers BEFORE
  // decompressing anything. Catches zip bombs without allocating memory.
  const declaredTotalSize = validEntries.reduce(
    (sum, e) => sum + (e.header?.size || 0),
    0
  );
  if (declaredTotalSize > MAX_EXTRACTED_SIZE) {
    throw new Error(
      `ZIP declares ${Math.round(declaredTotalSize / 1024 / 1024)}MB uncompressed, exceeds ${MAX_EXTRACTED_SIZE / 1024 / 1024}MB limit (zip bomb protection)`
    );
  }

  // Normalize paths: strip common top-level directory if all files share one
  const paths = validEntries.map((e) => e.entryName.replace(/\\/g, "/"));
  const commonPrefix = findCommonPrefix(paths);
  const normalize = (p: string) => {
    const stripped = commonPrefix ? p.slice(commonPrefix.length) : p;
    return stripped.replace(/^\//, "");
  };

  const normalizedPaths = paths.map(normalize);

  // Resolve entrypoint — check normalized paths.
  // If a custom entrypoint was explicitly provided (not the default), require an exact match.
  // Only fall back to searching for index.html when using the default.
  let resolvedEntrypoint: string | undefined;
  if (normalizedPaths.includes(entrypoint)) {
    resolvedEntrypoint = entrypoint;
  } else if (entrypoint === "index.html") {
    // Default entrypoint: also accept nested index.html
    resolvedEntrypoint = normalizedPaths.find((p) => p.endsWith("/index.html") || p === "index.html");
  }

  if (!resolvedEntrypoint) {
    const htmlFiles = normalizedPaths.filter((p) => p.endsWith(".html"));
    throw new Error(
      `Entrypoint "${entrypoint}" not found in ZIP. Available HTML files: ${htmlFiles.join(", ") || "(none)"}`
    );
  }

  // Upload files to GCS with uncompressed size guard.
  // Extract and upload sequentially to avoid materializing entire ZIP in memory.
  const bucket = adminStorage.bucket(BUCKET_NAME);
  const storagePrefix = `dashboards/${userId}/${dashboardId}/`;
  let totalSizeBytes = 0;

  for (let i = 0; i < validEntries.length; i++) {
    const entry = validEntries[i];
    const relativePath = normalizedPaths[i];
    const data = entry.getData();
    totalSizeBytes += data.length;

    if (totalSizeBytes > MAX_EXTRACTED_SIZE) {
      throw new Error(
        `Extracted content exceeds ${MAX_EXTRACTED_SIZE / 1024 / 1024}MB limit (zip bomb protection)`
      );
    }

    const gcsPath = `${storagePrefix}${relativePath}`;
    const file = bucket.file(gcsPath);
    const contentType = getContentType(relativePath);

    await file.save(data, {
      contentType,
      metadata: {
        cacheControl: "public, max-age=3600",
      },
    });
  }

  return {
    storagePrefix,
    storagePath: `${storagePrefix}${resolvedEntrypoint}`,
    entrypoint: resolvedEntrypoint,
    files: normalizedPaths,
    totalSizeBytes,
  };
}

/**
 * Get a specific asset file from a dashboard's GCS storage.
 * Used by the sub-path serving route for multi-page dashboards.
 */
export async function getDashboardAsset(
  storagePrefix: string,
  relativePath: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!isPathSafe(relativePath)) {
    return null;
  }

  const gcsPath = `${storagePrefix}${relativePath}`;
  const bucket = adminStorage.bucket(BUCKET_NAME);
  const file = bucket.file(gcsPath);

  try {
    const [exists] = await file.exists();
    if (!exists) return null;
    const [contents] = await file.download();
    return {
      buffer: contents,
      contentType: getContentType(relativePath),
    };
  } catch {
    return null;
  }
}

/**
 * Delete all files under a storage prefix (for multi-page dashboard cleanup).
 */
export async function deleteDashboardFiles(storagePrefix: string): Promise<void> {
  const bucket = adminStorage.bucket(BUCKET_NAME);
  await bucket.deleteFiles({ prefix: storagePrefix, force: true });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Find the common directory prefix shared by all paths.
 * e.g., ["foo/a.html", "foo/b.css"] → "foo/"
 *        ["a.html", "b.css"] → ""
 */
function findCommonPrefix(paths: string[]): string {
  if (paths.length === 0) return "";
  if (paths.length === 1) {
    const lastSlash = paths[0].lastIndexOf("/");
    return lastSlash > 0 ? paths[0].slice(0, lastSlash + 1) : "";
  }

  // Check if all paths share a common first directory segment
  const firstSegments = paths.map((p) => {
    const slashIdx = p.indexOf("/");
    return slashIdx > 0 ? p.slice(0, slashIdx + 1) : "";
  });

  const candidate = firstSegments[0];
  if (!candidate) return "";
  if (firstSegments.every((s) => s === candidate)) return candidate;
  return "";
}
