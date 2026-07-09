import { createHmac, createHash, timingSafeEqual } from "crypto";
import type { CredentialRef } from "@/lib/data-sources/credentials";

const TOKEN_TTL_MS = 15 * 60 * 1000;
const DEV_INSPECTION_SECRET = "dev-data-source-inspection-token-secret";

export type InspectionCredentialProof =
  | { kind: "inline"; sha256: string; dataSourceId?: string; configVersion?: number }
  | { kind: "stored"; dataSourceId: string; configVersion: number; credentialRef: CredentialRef };

type TokenCredentialProof =
  | { kind: "inline"; sha256: string; dataSourceId?: string; configVersion?: number }
  | { kind: "stored"; dataSourceId: string; configVersion: number; refHash: string };

export interface DataSourceInspectionTokenInput {
  bucket: string;
  prefix: string;
  credentialRef: CredentialRef;
  credentialProof: InspectionCredentialProof;
  headers: string[];
  duplicateIdentities: string[];
}

export interface DataSourceInspectionPayload {
  bucket: string;
  prefix: string;
  refHash: string;
  credentialProof: TokenCredentialProof;
  headers: string[];
  duplicateIdentities: string[];
  issuedAt: number;
}

export type DataSourceInspectionVerifyResult =
  | { ok: true; payload: DataSourceInspectionPayload }
  | { ok: false; error: string };

export function createDataSourceInspectionToken(
  payload: DataSourceInspectionTokenInput,
): string {
  const fullPayload: DataSourceInspectionPayload = {
    bucket: normalizeBucket(payload.bucket),
    prefix: normalizeDataSourcePrefix(payload.prefix),
    refHash: refHash(payload.credentialRef),
    credentialProof: tokenCredentialProof(payload.credentialProof),
    headers: [...payload.headers],
    duplicateIdentities: [...payload.duplicateIdentities],
    issuedAt: Date.now(),
  };
  const encoded = base64UrlEncode(JSON.stringify(fullPayload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifyDataSourceInspectionToken(args: {
  token: string | undefined;
  bucket: string;
  prefix: string;
  credentialRef: CredentialRef;
  credentialProof: InspectionCredentialProof;
  ownerColumn: string;
}): DataSourceInspectionVerifyResult {
  if (!args.token || typeof args.token !== "string") {
    return { ok: false, error: "inspectionToken is required" };
  }

  const [encoded, signature, extra] = args.token.split(".");
  if (!encoded || !signature || extra !== undefined) {
    return { ok: false, error: "inspectionToken is invalid" };
  }
  if (!safeEqual(signature, sign(encoded))) {
    return { ok: false, error: "inspectionToken signature is invalid" };
  }

  let payload: DataSourceInspectionPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encoded).toString("utf8")) as DataSourceInspectionPayload;
  } catch {
    return { ok: false, error: "inspectionToken payload is invalid" };
  }

  if (!isValidPayload(payload)) {
    return { ok: false, error: "inspectionToken payload is invalid" };
  }
  if (Date.now() - payload.issuedAt > TOKEN_TTL_MS) {
    return { ok: false, error: "inspectionToken expired" };
  }

  const expected = {
    bucket: normalizeBucket(args.bucket),
    prefix: normalizeDataSourcePrefix(args.prefix),
    refHash: refHash(args.credentialRef),
    credentialProof: tokenCredentialProof(args.credentialProof),
  };
  const actual = {
    bucket: normalizeBucket(payload.bucket),
    prefix: normalizeDataSourcePrefix(payload.prefix),
    refHash: payload.refHash,
    credentialProof: payload.credentialProof,
  };

  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    if (isStaleCredentialProof(actual.credentialProof, expected.credentialProof)) {
      return { ok: false, error: "inspectionToken configVersion is stale" };
    }
    return { ok: false, error: "inspectionToken does not match data source inputs" };
  }
  if (payload.duplicateIdentities.length > 0) {
    return { ok: false, error: "CSV headers contain duplicate normalized identities" };
  }
  if (!payload.headers.some((header) => header.trim() === args.ownerColumn.trim())) {
    return { ok: false, error: "ownerColumn was not inspected" };
  }

  return { ok: true, payload };
}

export function credentialEncProof(
  credentialEnc: string,
  context?: { dataSourceId: string; configVersion: number },
): InspectionCredentialProof {
  return {
    kind: "inline",
    sha256: sha256(credentialEnc.trim()),
    ...(context
      ? { dataSourceId: context.dataSourceId, configVersion: context.configVersion }
      : {}),
  };
}

export function storedCredentialProof(args: {
  dataSourceId: string;
  configVersion: number;
  credentialRef: CredentialRef;
}): InspectionCredentialProof {
  return {
    kind: "stored",
    dataSourceId: args.dataSourceId,
    configVersion: args.configVersion,
    credentialRef: normalizeCredentialRef(args.credentialRef),
  };
}

export function normalizeDataSourcePrefix(prefix: string): string {
  const trimmed = prefix.trim().replace(/^\/+/, "");
  if (!trimmed) return "";
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

function normalizeBucket(bucket: string): string {
  return bucket.trim();
}

function normalizeCredentialRef(ref: CredentialRef): CredentialRef {
  return { kind: ref.kind, ref: ref.ref.trim() };
}

function tokenCredentialProof(proof: InspectionCredentialProof): TokenCredentialProof {
  if (proof.kind === "inline") {
    return {
      kind: "inline",
      sha256: proof.sha256,
      ...(proof.dataSourceId !== undefined && proof.configVersion !== undefined
        ? { dataSourceId: proof.dataSourceId, configVersion: proof.configVersion }
        : {}),
    };
  }
  return {
    kind: "stored",
    dataSourceId: proof.dataSourceId,
    configVersion: proof.configVersion,
    refHash: refHash(proof.credentialRef),
  };
}

function isStaleCredentialProof(
  actual: TokenCredentialProof,
  expected: TokenCredentialProof,
): boolean {
  if (actual.kind === "stored" && expected.kind === "stored") {
    return actual.dataSourceId === expected.dataSourceId &&
      actual.configVersion !== expected.configVersion;
  }
  if (actual.kind === "inline" && expected.kind === "inline") {
    return (
      actual.dataSourceId !== undefined &&
      expected.dataSourceId !== undefined &&
      actual.dataSourceId === expected.dataSourceId &&
      actual.configVersion !== expected.configVersion
    );
  }
  return false;
}

function refHash(ref: CredentialRef): string {
  return sha256(JSON.stringify(normalizeCredentialRef(ref)));
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isValidPayload(value: unknown): value is DataSourceInspectionPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const payload = value as DataSourceInspectionPayload;
  return (
    typeof payload.bucket === "string" &&
    typeof payload.prefix === "string" &&
    typeof payload.refHash === "string" &&
    isTokenCredentialProof(payload.credentialProof) &&
    Array.isArray(payload.headers) &&
    payload.headers.every((header) => typeof header === "string") &&
    Array.isArray(payload.duplicateIdentities) &&
    payload.duplicateIdentities.every((identity) => typeof identity === "string") &&
    typeof payload.issuedAt === "number"
  );
}

function isTokenCredentialProof(value: unknown): value is TokenCredentialProof {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proof = value as TokenCredentialProof;
  if (proof.kind === "inline") {
    return (
      typeof proof.sha256 === "string" &&
      (proof.dataSourceId === undefined || typeof proof.dataSourceId === "string") &&
      (proof.configVersion === undefined || typeof proof.configVersion === "number")
    );
  }
  return (
    proof.kind === "stored" &&
    typeof proof.dataSourceId === "string" &&
    typeof proof.configVersion === "number" &&
    typeof proof.refHash === "string"
  );
}

function sign(encodedPayload: string): string {
  return createHmac("sha256", inspectionSecret()).update(encodedPayload).digest("base64url");
}

function inspectionSecret(): string {
  const secret = process.env.TWD_INSPECTION_TOKEN_SECRET || process.env.DASHBOARD_SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "TWD_INSPECTION_TOKEN_SECRET or DASHBOARD_SESSION_SECRET is required in production",
    );
  }
  return DEV_INSPECTION_SECRET;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}
