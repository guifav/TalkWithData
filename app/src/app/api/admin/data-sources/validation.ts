import type { CredentialRef } from "@/lib/data-sources/credentials";
import type {
  CreateDataSourceInput,
  DataSourceAccessGrants,
  UpdateDataSourcePatch,
} from "@/lib/data-sources/firestore";

export type CreateDataSourceRequest = CreateDataSourceInput & { inspectionToken: string };
export type UpdateDataSourceRequest = UpdateDataSourcePatch & { inspectionToken?: string };

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

const ALLOWED_FIELDS = new Set([
  "kind",
  "name",
  "bucket",
  "prefix",
  "credentialRef",
  "credentialEnc",
  "ownerColumn",
  "accessGrants",
  "inspectionToken",
]);

export function parseCreateDataSourceBody(
  body: unknown,
): ParseResult<CreateDataSourceRequest> {
  const common = parseCommonBody(body);
  if (!common.ok) return common;

  const data = common.value;
  if (data.kind !== "csv") {
    return { ok: false, error: "kind must be csv" };
  }
  if (!isNonEmptyString(data.bucket)) {
    return { ok: false, error: "bucket is required" };
  }
  if (data.bucket.trim().startsWith("gs://")) {
    return { ok: false, error: "bucket must not include gs://" };
  }
  if (typeof data.prefix !== "string") {
    return { ok: false, error: "prefix is required" };
  }
  if (!isCredentialRef(data.credentialRef)) {
    return { ok: false, error: "credentialRef is invalid" };
  }
  if (!isNonEmptyString(data.ownerColumn)) {
    return { ok: false, error: "ownerColumn is required" };
  }
  if (!isNonEmptyString(data.credentialEnc)) {
    return { ok: false, error: "credentialEnc is required" };
  }
  if (!isNonEmptyString(data.inspectionToken)) {
    return { ok: false, error: "inspectionToken is required" };
  }

  const grants = parseAccessGrants(data.accessGrants);
  if (!grants.ok) return grants;

  const input: CreateDataSourceRequest = {
    kind: "csv",
    bucket: data.bucket.trim(),
    prefix: data.prefix,
    credentialRef: data.credentialRef,
    ownerColumn: data.ownerColumn.trim(),
    accessGrants: grants.value,
    inspectionToken: data.inspectionToken.trim(),
  };

  if (data.name !== undefined) {
    if (typeof data.name !== "string") {
      return { ok: false, error: "name must be a string" };
    }
    input.name = data.name.trim();
  }
  if (data.credentialEnc !== undefined) {
    input.credentialEnc = data.credentialEnc.trim();
  }

  return { ok: true, value: input };
}

export function parseUpdateDataSourceBody(
  body: unknown,
): ParseResult<UpdateDataSourceRequest> {
  const common = parseCommonBody(body);
  if (!common.ok) return common;

  const data = common.value;
  const patch: UpdateDataSourceRequest = {};

  if ("kind" in data) {
    if (data.kind !== "csv") {
      return { ok: false, error: "kind must be csv" };
    }
    patch.kind = "csv";
  }

  if ("name" in data) {
    if (typeof data.name !== "string") {
      return { ok: false, error: "name must be a string" };
    }
    patch.name = data.name.trim();
  }

  if ("bucket" in data) {
    if (!isNonEmptyString(data.bucket)) {
      return { ok: false, error: "bucket must be a non-empty string" };
    }
    if (data.bucket.trim().startsWith("gs://")) {
      return { ok: false, error: "bucket must not include gs://" };
    }
    patch.bucket = data.bucket.trim();
  }

  if ("prefix" in data) {
    if (typeof data.prefix !== "string") {
      return { ok: false, error: "prefix must be a string" };
    }
    patch.prefix = data.prefix;
  }

  if ("credentialRef" in data) {
    if (!isCredentialRef(data.credentialRef)) {
      return { ok: false, error: "credentialRef is invalid" };
    }
    patch.credentialRef = data.credentialRef;
  }

  if ("credentialEnc" in data) {
    if (!isNonEmptyString(data.credentialEnc)) {
      return { ok: false, error: "credentialEnc must be a non-empty string" };
    }
    patch.credentialEnc = data.credentialEnc.trim();
  }

  if ("ownerColumn" in data) {
    if (!isNonEmptyString(data.ownerColumn)) {
      return { ok: false, error: "ownerColumn must be a non-empty string" };
    }
    patch.ownerColumn = data.ownerColumn.trim();
  }

  if ("accessGrants" in data) {
    const grants = parseAccessGrants(data.accessGrants);
    if (!grants.ok) return grants;
    patch.accessGrants = grants.value;
  }

  if ("inspectionToken" in data) {
    if (!isNonEmptyString(data.inspectionToken)) {
      return { ok: false, error: "inspectionToken must be a non-empty string" };
    }
    patch.inspectionToken = data.inspectionToken.trim();
  }

  return { ok: true, value: patch };
}

function parseCommonBody(body: unknown): ParseResult<Record<string, unknown>> {
  if (!isPlainObject(body)) {
    return { ok: false, error: "Body must be a JSON object" };
  }

  for (const key of Object.keys(body)) {
    if (!ALLOWED_FIELDS.has(key)) {
      return { ok: false, error: `Unsupported field: ${key}` };
    }
  }

  return { ok: true, value: body };
}

function parseAccessGrants(value: unknown): ParseResult<DataSourceAccessGrants> {
  if (!isPlainObject(value)) {
    return { ok: false, error: "accessGrants is required" };
  }

  if (!isStringArray(value.assignedUsers)) {
    return { ok: false, error: "assignedUsers must be an array of strings" };
  }
  if (!isStringArray(value.assignedDepartments)) {
    return {
      ok: false,
      error: "assignedDepartments must be an array of strings",
    };
  }

  return {
    ok: true,
    value: {
      assignedUsers: [...value.assignedUsers],
      assignedDepartments: [...value.assignedDepartments],
    },
  };
}

function isCredentialRef(value: unknown): value is CredentialRef {
  if (!isPlainObject(value)) return false;
  if (value.kind !== "encryptedBlob" && value.kind !== "secretManager") {
    return false;
  }

  return isNonEmptyString(value.ref);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
