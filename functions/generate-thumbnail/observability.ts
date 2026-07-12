import { randomUUID } from "node:crypto";

type ThumbnailEventName =
  | "thumbnail.generation.started"
  | "thumbnail.generation.succeeded"
  | "thumbnail.generation.failed";
type LogLevel = "info" | "warn" | "error";

interface ThumbnailEvent {
  level: LogLevel;
  event: ThumbnailEventName;
  correlationId: string;
  metadata?: Record<string, unknown>;
}

interface LogSink {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

const SAFE_CORRELATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_DEPTH = 4;
const MAX_ITEMS = 20;
const MAX_KEYS = 40;
const MAX_STRING_LENGTH = 256;

const SENSITIVE_KEYS = new Set([
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
  "htmlcontent",
  "filecontent",
  "uploadedcontent",
  "uploadeddocumentcontent",
  "storagepath",
  "thumbnailstoragepath",
  "bucket",
  "bucketname",
]);

export function createFunctionCorrelationId(
  candidate: string | undefined,
  generate: () => string = randomUUID,
): string {
  return candidate && SAFE_CORRELATION_ID.test(candidate) ? candidate : generate();
}

export function writeThumbnailEvent(
  input: ThumbnailEvent,
  sink: LogSink = console,
  now: () => Date = () => new Date(),
): void {
  if (!shouldWrite(input.level, process.env.TWD_LOG_LEVEL)) return;
  const metadata = sanitizeValue(input.metadata ?? {}, 0, new WeakSet());

  sink[input.level](JSON.stringify({
    timestamp: now().toISOString(),
    level: input.level,
    event: input.event,
    correlationId: input.correlationId,
    ...(isRecord(metadata) ? metadata : {}),
  }));
}

function shouldWrite(level: LogLevel, configured: string | undefined): boolean {
  const priorities: Record<LogLevel, number> = { info: 0, warn: 1, error: 2 };
  const normalized = configured?.trim().toLowerCase();
  const threshold = normalized === "warn" || normalized === "error" ? normalized : "info";
  return priorities[level] >= priorities[threshold];
}

function sanitizeValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.slice(0, MAX_STRING_LENGTH);
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Error) return sanitizeError(value);
  if (typeof value !== "object") return String(value).slice(0, MAX_STRING_LENGTH);
  if (seen.has(value)) return "[CIRCULAR]";
  if (depth >= MAX_DEPTH) return "[MAX_DEPTH]";
  seen.add(value);

  if (Array.isArray(value)) {
    const result = value.slice(0, MAX_ITEMS).map((item) =>
      sanitizeValue(item, depth + 1, seen));
    seen.delete(value);
    return result;
  }

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value).slice(0, MAX_KEYS)) {
    if (isSensitiveKey(key)) continue;
    result[key] = sanitizeValue(item, depth + 1, seen);
  }
  seen.delete(value);
  return result;
}

function sanitizeError(error: Error): Record<string, unknown> {
  const result: Record<string, unknown> = {
    name: /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(error.name) ? error.name : "Error",
  };
  const code = (error as Error & { code?: unknown }).code;
  const status = (error as Error & { status?: unknown }).status;
  if (typeof code === "string" || typeof code === "number") {
    result.code = String(code).slice(0, 64);
  }
  if (typeof status === "number" && Number.isFinite(status)) result.status = status;
  return result;
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return (
    SENSITIVE_KEYS.has(normalized) ||
    normalized.includes("authorization") ||
    normalized.includes("cookie") ||
    normalized.includes("secret") ||
    normalized.includes("credential") ||
    normalized.includes("capability") ||
    normalized.includes("serviceaccount") ||
    normalized.includes("privatekey") ||
    normalized.includes("internalkey") ||
    normalized.includes("token") ||
    normalized.includes("email") ||
    normalized.endsWith("path") ||
    normalized.endsWith("key")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
