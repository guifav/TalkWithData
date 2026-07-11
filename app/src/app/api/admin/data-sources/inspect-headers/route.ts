import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/api-auth";
import { SecretService, type CredentialRef } from "@/lib/data-sources/credentials";
import { getDataSourceWithCredentials } from "@/lib/data-sources/firestore";
import { createGcsStorage } from "@/lib/data-sources/storage";
import { parseCsvHeader } from "@/lib/data-sources/csv-table";
import {
  createDataSourceInspectionToken,
  credentialEncProof,
  normalizeDataSourcePrefix,
  storedCredentialProof,
  type InspectionCredentialProof,
} from "@/lib/data-sources/inspection-token";

export const dynamic = "force-dynamic";

type InspectHeadersBody = {
  dataSourceId?: string;
  bucket?: string;
  prefix?: string;
  credentialRef?: CredentialRef;
  credentialEnc?: string;
  credential?: unknown;
};

const MAX_RAW_CREDENTIAL_BYTES = 64 * 1024;

export async function POST(request: NextRequest) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as InspectHeadersBody;
    const resolved = await resolveInspectInput(body);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }

    const {
      bucket,
      prefix,
      credentialRef,
      credentialEnc,
      credentialProof,
      generatedCredentialEnc,
    } = resolved.value;
    if (credentialRef.kind === "secretManager") {
      return NextResponse.json(
        { error: "secretManager credentials are not supported yet" },
        { status: 400 },
      );
    }

    const secretService = new SecretService({
      loadEncryptedBlob: async (ref: string) => {
        if (ref !== credentialRef.ref) {
          throw new Error("credentialRef mismatch");
        }
        return Buffer.from(credentialEnc, "base64");
      },
    });
    const credentials = await secretService.resolve(credentialRef);
    const storage = createGcsStorage({ bucketName: bucket, credentials });
    const listed = await storage.list(prefix, { maxResults: 25 });
    const csvObject = listed.objects.find((object) =>
      String(object.name).toLowerCase().endsWith(".csv"),
    );

    if (!csvObject) {
      return NextResponse.json(
        { error: "No CSV object found for this prefix" },
        { status: 404 },
      );
    }

    const headerBytes = await storage.readPrefix(csvObject.name, 64 * 1024);
    const header = parseCsvHeader(headerBytes);
    const normalized = header.map((rawName) => ({
      rawName,
      identity: normalizedHeaderIdentity(rawName),
    }));
    const duplicateIdentities = Array.from(
      normalized.reduce((counts, item) => {
        counts.set(item.identity, (counts.get(item.identity) ?? 0) + 1);
        return counts;
      }, new Map<string, number>()),
    )
      .filter(([, count]) => count > 1)
      .map(([identity]) => identity);

    const inspectionToken = createDataSourceInspectionToken({
      bucket,
      prefix,
      credentialRef,
      credentialProof,
      headers: header,
      duplicateIdentities,
    });

    return NextResponse.json({
      headers: header,
      columns: normalized,
      duplicateIdentities,
      inspectionToken,
      objectName: csvObject.name,
      ...(generatedCredentialEnc ? { credentialEnc: generatedCredentialEnc } : {}),
    });
  } catch {
    console.error("Inspect data source headers failed");
    return NextResponse.json(
      { error: "Failed to inspect headers" },
      { status: 503 },
    );
  }
}

async function resolveInspectInput(body: InspectHeadersBody): Promise<
  | {
      ok: true;
      value: {
        bucket: string;
        prefix: string;
        credentialRef: CredentialRef;
        credentialEnc: string;
        credentialProof: InspectionCredentialProof;
        generatedCredentialEnc?: string;
      };
    }
  | { ok: false; error: string }
> {
  const suppliedCredential = resolveSuppliedCredential(body);
  if (!suppliedCredential.ok) {
    return suppliedCredential;
  }

  if (body.dataSourceId) {
    const existing = await getDataSourceWithCredentials(body.dataSourceId);
    if (!existing) return { ok: false, error: "Data source not found" };

    const bucket = isNonEmptyString(body.bucket) ? body.bucket.trim() : existing.bucket;
    const prefix = typeof body.prefix === "string" ? normalizePrefix(body.prefix) : existing.prefix;

    if (suppliedCredential.value) {
      const credentialRef = isCredentialRef(body.credentialRef)
        ? body.credentialRef
        : existing.credentialRef;
      return {
        ok: true,
        value: {
          bucket,
          prefix,
          credentialRef,
          credentialEnc: suppliedCredential.value.credentialEnc,
          credentialProof: credentialEncProof(suppliedCredential.value.credentialEnc, {
            dataSourceId: existing.id,
            configVersion: existing.configVersion,
          }),
          generatedCredentialEnc: suppliedCredential.value.generatedCredentialEnc,
        },
      };
    }

    if (!existing.credentialEnc) {
      return { ok: false, error: "Data source has no credential configured" };
    }
    return {
      ok: true,
      value: {
        bucket,
        prefix,
        credentialRef: existing.credentialRef,
        credentialEnc: existing.credentialEnc,
        credentialProof: storedCredentialProof({
          dataSourceId: existing.id,
          configVersion: existing.configVersion,
          credentialRef: existing.credentialRef,
        }),
      },
    };
  }

  if (!isNonEmptyString(body.bucket)) {
    return { ok: false, error: "bucket is required" };
  }
  if (body.bucket.trim().startsWith("gs://")) {
    return { ok: false, error: "bucket must not include gs://" };
  }
  if (typeof body.prefix !== "string") {
    return { ok: false, error: "prefix is required" };
  }
  if (!isCredentialRef(body.credentialRef)) {
    return { ok: false, error: "credentialRef is invalid" };
  }
  if (!suppliedCredential.value) {
    return { ok: false, error: "credentialEnc is required" };
  }

  return {
    ok: true,
    value: {
      bucket: body.bucket.trim(),
      prefix: normalizePrefix(body.prefix),
      credentialRef: body.credentialRef,
      credentialEnc: suppliedCredential.value.credentialEnc,
      credentialProof: credentialEncProof(suppliedCredential.value.credentialEnc),
      generatedCredentialEnc: suppliedCredential.value.generatedCredentialEnc,
    },
  };
}

function resolveSuppliedCredential(body: InspectHeadersBody):
  | {
      ok: true;
      value:
        | { credentialEnc: string; generatedCredentialEnc?: string }
        | undefined;
    }
  | { ok: false; error: string } {
  const hasRawCredential = body.credential !== undefined;
  const hasEncryptedCredential = body.credentialEnc !== undefined;

  if (hasRawCredential && hasEncryptedCredential) {
    return {
      ok: false,
      error: "credential and credentialEnc are mutually exclusive",
    };
  }

  if (hasRawCredential) {
    const validated = validateServiceAccountCredential(body.credential);
    if (!validated.ok) return validated;

    const credentialEnc = new SecretService()
      .encrypt(validated.value)
      .toString("base64");
    return {
      ok: true,
      value: { credentialEnc, generatedCredentialEnc: credentialEnc },
    };
  }

  if (isNonEmptyString(body.credentialEnc)) {
    return {
      ok: true,
      value: { credentialEnc: body.credentialEnc.trim() },
    };
  }

  return { ok: true, value: undefined };
}

function validateServiceAccountCredential(value: unknown):
  | { ok: true; value: object }
  | { ok: false; error: string } {
  if (!isPlainObject(value)) {
    return {
      ok: false,
      error: "credential must be a valid service account JSON object",
    };
  }

  if (Buffer.byteLength(JSON.stringify(value), "utf8") > MAX_RAW_CREDENTIAL_BYTES) {
    return { ok: false, error: "credential exceeds the 64 KiB limit" };
  }

  if (
    value.type !== "service_account" ||
    !isNonEmptyString(value.project_id) ||
    !isNonEmptyString(value.client_email) ||
    !isNonEmptyString(value.private_key)
  ) {
    return {
      ok: false,
      error: "credential must be a valid service account JSON object",
    };
  }

  return { ok: true, value };
}

function normalizePrefix(prefix: string): string {
  return normalizeDataSourcePrefix(prefix);
}

function normalizedHeaderIdentity(rawName: string): string {
  return rawName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function isCredentialRef(value: unknown): value is CredentialRef {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const ref = value as { kind?: unknown; ref?: unknown };
  if (ref.kind !== "encryptedBlob" && ref.kind !== "secretManager") return false;
  return isNonEmptyString(ref.ref);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
