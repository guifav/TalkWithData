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
};

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

    const { bucket, prefix, credentialRef, credentialEnc, credentialProof } = resolved.value;
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
    });
  } catch (error) {
    console.error("Inspect data source headers failed:", error);
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
      };
    }
  | { ok: false; error: string }
> {
  if (body.dataSourceId) {
    const existing = await getDataSourceWithCredentials(body.dataSourceId);
    if (!existing) return { ok: false, error: "Data source not found" };

    const bucket = isNonEmptyString(body.bucket) ? body.bucket.trim() : existing.bucket;
    const prefix = typeof body.prefix === "string" ? normalizePrefix(body.prefix) : existing.prefix;

    if (isNonEmptyString(body.credentialEnc)) {
      const credentialRef = isCredentialRef(body.credentialRef)
        ? body.credentialRef
        : existing.credentialRef;
      return {
        ok: true,
        value: {
          bucket,
          prefix,
          credentialRef,
          credentialEnc: body.credentialEnc.trim(),
          credentialProof: credentialEncProof(body.credentialEnc, {
            dataSourceId: existing.id,
            configVersion: existing.configVersion,
          }),
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
  if (!isNonEmptyString(body.credentialEnc)) {
    return { ok: false, error: "credentialEnc is required" };
  }

  return {
    ok: true,
    value: {
      bucket: body.bucket.trim(),
      prefix: normalizePrefix(body.prefix),
      credentialRef: body.credentialRef,
      credentialEnc: body.credentialEnc.trim(),
      credentialProof: credentialEncProof(body.credentialEnc),
    },
  };
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
