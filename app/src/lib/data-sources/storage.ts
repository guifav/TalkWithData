import { Storage } from "@google-cloud/storage";

const DEFAULT_READ_MAX_BYTES = 50 * 1024 * 1024;

export interface ExternalBucketStorage {
  list(
    prefix: string,
    opts?: { pageToken?: string; maxResults?: number },
  ): Promise<{ objects: { name: string; md5Hash: string }[]; nextPageToken?: string }>;
  readByKey(
    key: string,
    opts?: { maxBytes?: number },
  ): Promise<{ content: Buffer; md5Hash: string }>;
}

export class ExternalStorageConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExternalStorageConfigError";
    Object.setPrototypeOf(this, ExternalStorageConfigError.prototype);
  }
}

export class ExternalStoragePathError extends Error {
  constructor(pathValue: string) {
    super(`Path externo inválido: ${pathValue}`);
    this.name = "ExternalStoragePathError";
    Object.setPrototypeOf(this, ExternalStoragePathError.prototype);
  }
}

export class ExternalStorageReadTooLargeError extends Error {
  readonly maxBytes: number;
  readonly actualBytes: number;

  constructor(actualBytes: number, maxBytes: number) {
    super(`Objeto externo excede o limite de leitura de ${maxBytes} bytes`);
    this.name = "ExternalStorageReadTooLargeError";
    this.actualBytes = actualBytes;
    this.maxBytes = maxBytes;
    Object.setPrototypeOf(this, ExternalStorageReadTooLargeError.prototype);
  }
}

export class ExternalStorageCredentialError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "ExternalStorageCredentialError";
    this.cause = cause;
    Object.setPrototypeOf(this, ExternalStorageCredentialError.prototype);
  }
}

export function createGcsStorage(opts: {
  bucketName: string;
  credentials: object;
}): ExternalBucketStorage {
  const bucketName = opts.bucketName?.trim();

  if (!bucketName) {
    throw new ExternalStorageConfigError("bucketName externo é obrigatório");
  }

  if (!isPlainObject(opts.credentials)) {
    throw new ExternalStorageConfigError("credentials externos são obrigatórios");
  }

  return new GcsExternalBucketStorage(bucketName, opts.credentials);
}

class GcsExternalBucketStorage implements ExternalBucketStorage {
  private readonly storage: Storage;
  private readonly bucketName: string;

  constructor(bucketName: string, credentials: object) {
    this.bucketName = bucketName;
    this.storage = new Storage({
      credentials,
      projectId: readProjectId(credentials),
    });
  }

  async list(
    prefix: string,
    opts: { pageToken?: string; maxResults?: number } = {},
  ): Promise<{ objects: { name: string; md5Hash: string }[]; nextPageToken?: string }> {
    const safePrefix = validateExternalPath(prefix, { allowEmpty: true });

    try {
      const [files, nextQuery] = await this.storage.bucket(this.bucketName).getFiles({
        prefix: safePrefix,
        pageToken: opts.pageToken,
        maxResults: opts.maxResults,
        autoPaginate: false,
      });

      return {
        objects: files.map((file) => ({
          name: file.name,
          md5Hash: readContentHash(file.metadata),
        })),
        nextPageToken: readNextPageToken(nextQuery),
      };
    } catch (error) {
      throw wrapCredentialError(error);
    }
  }

  async readByKey(
    key: string,
    opts: { maxBytes?: number } = {},
  ): Promise<{ content: Buffer; md5Hash: string }> {
    const safeKey = validateExternalPath(key, { allowEmpty: false });
    const maxBytes = normalizeByteLimit(opts.maxBytes, "maxBytes");
    const file = this.storage.bucket(this.bucketName).file(safeKey);

    try {
      const [metadata] = await file.getMetadata();
      const metadataSize = readMetadataSize(metadata);

      if (metadataSize !== undefined && metadataSize > maxBytes) {
        throw new ExternalStorageReadTooLargeError(metadataSize, maxBytes);
      }

      const generation = readGeneration(metadata);
      const downloadOptions =
        generation !== undefined
          ? ({ generation } as unknown as Parameters<typeof file.download>[0])
          : undefined;
      const [content] = await file.download(downloadOptions as never);

      if (content.length > maxBytes) {
        throw new ExternalStorageReadTooLargeError(content.length, maxBytes);
      }

      return {
        content,
        md5Hash: readContentHash(metadata),
      };
    } catch (error) {
      if (error instanceof ExternalStorageReadTooLargeError) {
        throw error;
      }

      throw wrapCredentialError(error);
    }
  }
}

function validateExternalPath(value: string, opts: { allowEmpty: boolean }): string {
  if (typeof value !== "string") {
    throw new ExternalStoragePathError(String(value));
  }

  if (!opts.allowEmpty && value.length === 0) {
    throw new ExternalStoragePathError(value);
  }

  if (value.includes("\0") || value.startsWith("/") || value.startsWith("\\")) {
    throw new ExternalStoragePathError(value);
  }

  if (/^[A-Za-z]:[\\/]/.test(value)) {
    throw new ExternalStoragePathError(value);
  }

  const normalized = value.replace(/\\/g, "/");
  const segments = normalized.split("/");

  if (segments.some((segment) => segment === "..")) {
    throw new ExternalStoragePathError(value);
  }

  return normalized;
}

function readProjectId(credentials: object): string | undefined {
  if (!("project_id" in credentials)) {
    return undefined;
  }

  const projectId = (credentials as { project_id?: unknown }).project_id;
  return typeof projectId === "string" && projectId.trim() ? projectId : undefined;
}

function normalizeByteLimit(value: number | undefined, name: string): number {
  const limit = value ?? readEnvByteLimit("TWD_READ_MAX_BYTES", DEFAULT_READ_MAX_BYTES);

  if (!Number.isFinite(limit) || limit <= 0) {
    throw new ExternalStorageConfigError(`${name} deve ser maior que zero`);
  }

  return Math.floor(limit);
}

function readEnvByteLimit(name: string, fallback: number): number {
  const raw = process.env[name];

  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function readMetadataSize(metadata: { size?: unknown }): number | undefined {
  if (typeof metadata.size === "number" && Number.isFinite(metadata.size)) {
    return metadata.size;
  }

  if (typeof metadata.size === "string" && metadata.size.trim()) {
    const parsed = Number(metadata.size);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function readContentHash(metadata: { md5Hash?: unknown; etag?: unknown }): string {
  const md5Hash = metadata.md5Hash;

  if (typeof md5Hash === "string" && md5Hash) {
    return md5Hash;
  }

  const etag = metadata.etag;
  return typeof etag === "string" ? etag : "";
}

function readGeneration(metadata: { generation?: unknown }): string | undefined {
  if (typeof metadata.generation === "string" && metadata.generation) {
    return metadata.generation;
  }

  if (typeof metadata.generation === "number" && Number.isFinite(metadata.generation)) {
    return String(metadata.generation);
  }

  return undefined;
}

function readNextPageToken(nextQuery: unknown): string | undefined {
  if (
    typeof nextQuery === "object" &&
    nextQuery !== null &&
    "pageToken" in nextQuery &&
    typeof (nextQuery as { pageToken?: unknown }).pageToken === "string"
  ) {
    return (nextQuery as { pageToken: string }).pageToken;
  }

  return undefined;
}

function wrapCredentialError(error: unknown): Error {
  if (isCredentialError(error)) {
    return new ExternalStorageCredentialError("Credencial externa inválida ou expirada", error);
  }

  return error instanceof Error ? error : new Error(String(error));
}

function isCredentialError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  const statusCode = (error as { statusCode?: unknown }).statusCode;

  return code === 401 || code === 403 || statusCode === 401 || statusCode === 403;
}

function isPlainObject(value: unknown): value is object {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
