import { randomUUID } from "node:crypto";

export const OPERATIONAL_EVENTS = {
  uploadRejected: "request.upload.rejected",
  uploadFailed: "request.upload.failed",
  storageStarted: "storage.operation.started",
  storageSucceeded: "storage.operation.succeeded",
  storageFailed: "storage.operation.failed",
  migrationStarted: "migration.verification.started",
  migrationSucceeded: "migration.verification.succeeded",
  migrationFailed: "migration.verification.failed",
  thumbnailStarted: "thumbnail.generation.started",
  thumbnailSucceeded: "thumbnail.generation.succeeded",
  thumbnailFailed: "thumbnail.generation.failed",
} as const;

export type OperationalEventName = typeof OPERATIONAL_EVENTS[keyof typeof OPERATIONAL_EVENTS];
export type OperationalLogLevel = "info" | "warn" | "error";

interface OperationalEventInput {
  level: OperationalLogLevel;
  event: OperationalEventName;
  correlationId: string;
  metadata?: Record<string, unknown>;
}

interface OperationalLogSink {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

interface SerializationOptions {
  now?: () => Date;
}

interface WriteOptions extends SerializationOptions {
  sink?: OperationalLogSink;
}

type StorageOperation = "upload" | "download" | "copy" | "delete" | "exists" | "list" | "read_prefix";

interface StorageObservationOptions {
  generateId?: () => string;
  nowMs?: () => number;
}

const MAX_DEPTH = 4;
const MAX_COLLECTION_ITEMS = 20;
const MAX_OBJECT_KEYS = 40;
const MAX_STRING_LENGTH = 256;
const SAFE_CORRELATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EXACT_SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "setcookie",
  "body",
  "requestbody",
  "responsebody",
  "prompt",
  "prompts",
  "row",
  "rows",
  "rowdata",
  "rowcontents",
  "documentcontent",
  "documentcontents",
  "uploadedcontent",
  "uploadeddocument",
  "uploadeddocumentcontent",
  "uploadeddocumentcontents",
  "htmlcontent",
  "filecontent",
  "content",
  "path",
  "filepath",
  "sourcepath",
  "destinationpath",
  "bucket",
  "bucketname",
  "buffer",
  "buffers",
  "databaseurl",
  "dburl",
  "connectionstring",
  "pgurl",
  "password",
  "passwd",
  "pwd",
  "passphrase",
  "sakeyjson",
]);

export function createCorrelationId(
  candidate: string | null | undefined,
  generate: () => string = randomUUID,
): string {
  return candidate && SAFE_CORRELATION_ID.test(candidate) ? candidate : generate();
}

export function withCorrelationId<T extends Response>(response: T, correlationId: string): T {
  response.headers.set("x-request-id", correlationId);
  return response;
}

export async function observeStorageOperation<T>(
  operation: StorageOperation,
  task: () => Promise<T>,
  metadata: Record<string, unknown> = {},
  options: StorageObservationOptions = {},
): Promise<T> {
  const nowMs = options.nowMs ?? Date.now;
  const correlationId = createCorrelationId(undefined, options.generateId);
  const startedAt = nowMs();

  writeOperationalEvent({
    level: "info",
    event: OPERATIONAL_EVENTS.storageStarted,
    correlationId,
    metadata: { ...metadata, outcome: "started", operation },
  });

  try {
    const result = await task();
    writeOperationalEvent({
      level: "info",
      event: OPERATIONAL_EVENTS.storageSucceeded,
      correlationId,
      metadata: {
        ...metadata,
        outcome: "succeeded",
        operation,
        durationMs: Math.max(0, nowMs() - startedAt),
      },
    });
    return result;
  } catch (error) {
    writeOperationalEvent({
      level: "error",
      event: OPERATIONAL_EVENTS.storageFailed,
      correlationId,
      metadata: {
        ...metadata,
        outcome: "failed",
        operation,
        durationMs: Math.max(0, nowMs() - startedAt),
        error,
      },
    });
    throw error;
  }
}

export function serializeOperationalEvent(
  input: OperationalEventInput,
  options: SerializationOptions = {},
): string {
  const metadata = sanitizeValue(input.metadata ?? {}, 0, new WeakSet());
  const safeMetadata = isRecord(metadata) ? metadata : {};

  return JSON.stringify({
    ...safeMetadata,
    timestamp: (options.now ?? (() => new Date()))().toISOString(),
    level: input.level,
    event: input.event,
    correlationId: input.correlationId,
  });
}

export function writeOperationalEvent(
  input: OperationalEventInput,
  options: WriteOptions = {},
): void {
  if (!shouldWrite(input.level, process.env.TWD_LOG_LEVEL)) return;

  const sink = options.sink ?? console;
  sink[input.level](serializeOperationalEvent(input, options));
}

function shouldWrite(level: OperationalLogLevel, configured: string | undefined): boolean {
  const priorities: Record<OperationalLogLevel, number> = {
    info: 0,
    warn: 1,
    error: 2,
  };
  const normalized = configured?.trim().toLowerCase();
  const threshold = normalized === "warn" || normalized === "error" ? normalized : "info";
  return priorities[level] >= priorities[threshold];
}

function sanitizeValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return value.slice(0, MAX_STRING_LENGTH);
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Error) {
    return sanitizeError(value);
  }

  if (typeof value !== "object") {
    return String(value).slice(0, MAX_STRING_LENGTH);
  }

  if (seen.has(value)) return "[CIRCULAR]";
  if (depth >= MAX_DEPTH) return "[MAX_DEPTH]";
  seen.add(value);

  if (Array.isArray(value)) {
    const result = value
      .slice(0, MAX_COLLECTION_ITEMS)
      .map((item) => sanitizeValue(item, depth + 1, seen));
    seen.delete(value);
    return result;
  }

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value).slice(0, MAX_OBJECT_KEYS)) {
    if (isSensitiveKey(key)) continue;
    result[key] = sanitizeValue(item, depth + 1, seen);
  }
  seen.delete(value);
  return result;
}

function sanitizeError(error: Error): Record<string, unknown> {
  const result: Record<string, unknown> = {
    name: safeErrorName(error.name),
  };
  const code = (error as Error & { code?: unknown }).code;
  const status = (error as Error & { status?: unknown }).status;

  if (typeof code === "string" || typeof code === "number") {
    result.code = String(code).slice(0, 64);
  }
  if (typeof status === "number" && Number.isFinite(status)) {
    result.status = status;
  }
  return result;
}

function safeErrorName(name: string): string {
  return /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(name) ? name : "Error";
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return (
    EXACT_SENSITIVE_KEYS.has(normalized) ||
    normalized.includes("authorization") ||
    normalized.includes("cookie") ||
    normalized.includes("secret") ||
    normalized.includes("credential") ||
    normalized.includes("capability") ||
    normalized.includes("serviceaccount") ||
    normalized.includes("privatekey") ||
    normalized.includes("token") ||
    normalized.includes("email") ||
    normalized.includes("path") ||
    normalized.includes("bucket") ||
    (normalized.endsWith("key") && normalized !== "keycount")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
