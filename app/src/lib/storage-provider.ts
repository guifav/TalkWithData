import { Storage } from "@google-cloud/storage";
import { randomUUID } from "node:crypto";
import { promises as fs } from "fs";
import path from "path";
import { getStorageBucketName } from "@/lib/storage-bucket";
import { observeStorageOperation } from "@/lib/observability";

export interface StorageUploadOptions {
  contentType?: string;
  cacheControl?: string;
}

export interface StorageProvider {
  upload(path: string, buffer: Buffer, options?: StorageUploadOptions): Promise<void>;
  download(path: string): Promise<Buffer>;
  copy(sourcePath: string, destinationPath: string): Promise<void>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

export class GcsStorage implements StorageProvider {
  private readonly storage: Storage;
  private readonly bucketName: string;

  constructor() {
    this.bucketName = getStorageBucketName();
    this.storage = createGcsClient();
  }

  async upload(filePath: string, buffer: Buffer, options: StorageUploadOptions = {}): Promise<void> {
    await observeStorageOperation("upload", () =>
      this.storage.bucket(this.bucketName).file(filePath).save(buffer, {
        contentType: options.contentType,
        metadata: options.cacheControl
          ? { cacheControl: options.cacheControl }
          : undefined,
      }), { bytes: buffer.length, provider: "gcs" });
  }

  async download(filePath: string): Promise<Buffer> {
    return observeStorageOperation("download", async () => {
      const [contents] = await this.storage.bucket(this.bucketName).file(filePath).download();
      return contents;
    }, { provider: "gcs" });
  }

  async copy(sourcePath: string, destinationPath: string): Promise<void> {
    await observeStorageOperation("copy", async () => {
      const bucket = this.storage.bucket(this.bucketName);
      await bucket.file(sourcePath).copy(bucket.file(destinationPath));
    }, { provider: "gcs" });
  }

  async delete(filePath: string): Promise<void> {
    await observeStorageOperation("delete", async () => {
      const bucket = this.storage.bucket(this.bucketName);

      if (filePath.endsWith("/")) {
        await bucket.deleteFiles({ prefix: filePath, force: true });
        return;
      }

      await bucket
        .file(filePath)
        .delete({ ignoreNotFound: true })
        .catch((error: unknown) => {
          if (isNotFoundError(error)) return;
          throw error;
        });
    }, { provider: "gcs" });
  }

  async exists(filePath: string): Promise<boolean> {
    return observeStorageOperation("exists", async () => {
      const [exists] = await this.storage.bucket(this.bucketName).file(filePath).exists();
      return exists;
    }, { provider: "gcs" });
  }
}

export class LocalStorage implements StorageProvider {
  private readonly rootDir: string;

  constructor(rootDir = process.env.LOCAL_STORAGE_ROOT || "/data/uploads") {
    this.rootDir = rootDir;
  }

  async upload(filePath: string, buffer: Buffer): Promise<void> {
    await observeStorageOperation("upload", async () => {
      const fullPath = this.resolvePath(filePath);
      await this.replaceAtomically(fullPath, (temporaryPath) =>
        fs.writeFile(temporaryPath, buffer)
      );
    }, { bytes: buffer.length, provider: "local" });
  }

  async download(filePath: string): Promise<Buffer> {
    return observeStorageOperation(
      "download",
      () => fs.readFile(this.resolvePath(filePath)),
      { provider: "local" },
    );
  }

  async copy(sourcePath: string, destinationPath: string): Promise<void> {
    await observeStorageOperation("copy", async () => {
      const source = this.resolvePath(sourcePath);
      const destination = this.resolvePath(destinationPath);
      await this.replaceAtomically(destination, (temporaryPath) =>
        fs.copyFile(source, temporaryPath)
      );
    }, { provider: "local" });
  }

  async delete(filePath: string): Promise<void> {
    await observeStorageOperation("delete", async () => {
      const fullPath = this.resolvePath(filePath);

      try {
        const stats = await fs.stat(fullPath);
        if (stats.isDirectory()) {
          await fs.rm(fullPath, { recursive: true, force: true });
        } else {
          await fs.rm(fullPath, { force: true });
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
        throw error;
      }
    }, { provider: "local" });
  }

  async exists(filePath: string): Promise<boolean> {
    return observeStorageOperation("exists", async () => {
      try {
        await fs.access(this.resolvePath(filePath));
        return true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
        throw error;
      }
    }, { provider: "local" });
  }

  private async replaceAtomically(
    destinationPath: string,
    writeTemporaryFile: (temporaryPath: string) => Promise<void>
  ): Promise<void> {
    const destinationDirectory = path.dirname(destinationPath);
    const temporaryPath = path.join(
      destinationDirectory,
      `.${path.basename(destinationPath)}.${randomUUID()}.tmp`
    );

    await fs.mkdir(destinationDirectory, { recursive: true });
    try {
      await writeTemporaryFile(temporaryPath);
      await fs.rename(temporaryPath, destinationPath);
    } catch (error) {
      await fs.rm(temporaryPath, { force: true }).catch(() => {});
      throw error;
    }
  }

  private resolvePath(filePath: string): string {
    const normalized = filePath.replace(/\\/g, "/");
    const logicalPath = normalized.endsWith("/")
      ? normalized.slice(0, -1)
      : normalized;

    if (
      !logicalPath ||
      normalized.startsWith("/") ||
      normalized.includes("\0") ||
      logicalPath.split("/").some((segment) => !segment || segment === "." || segment === "..")
    ) {
      throw new Error(`Invalid storage path: ${filePath}`);
    }

    const fullPath = path.resolve(this.rootDir, normalized);
    const root = path.resolve(this.rootDir);

    if (fullPath !== root && !fullPath.startsWith(`${root}${path.sep}`)) {
      throw new Error(`Invalid storage path: ${filePath}`);
    }

    return fullPath;
  }
}

export function getStorageProvider(): StorageProvider {
  const provider = (process.env.STORAGE_PROVIDER || "gcs").trim().toLowerCase();

  if (provider === "local") {
    return new LocalStorage();
  }

  if (provider === "gcs") {
    return new GcsStorage();
  }

  throw new Error(`Invalid STORAGE_PROVIDER "${provider}". Expected "gcs" or "local".`);
}

function createGcsClient(): Storage {
  const saJson = process.env.SA_KEY_JSON;

  if (saJson) {
    try {
      const credentials = JSON.parse(saJson) as { project_id?: string };
      return new Storage({
        credentials,
        projectId: process.env.FIREBASE_PROJECT_ID || credentials.project_id,
      });
    } catch (error) {
      throw new Error(
        `Invalid SA_KEY_JSON: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return new Storage({ projectId: process.env.FIREBASE_PROJECT_ID || undefined });
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    ((error as { code?: number | string }).code === 404 ||
      (error as { code?: number | string }).code === "ENOENT")
  );
}
