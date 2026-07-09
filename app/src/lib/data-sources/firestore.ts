import { adminDb } from "@/lib/firebase/admin";
import type { CredentialRef } from "@/lib/data-sources/credentials";
import {
  DataSourceKind,
  type DataSource,
  type DataSourceAccessGrants,
} from "@/lib/data-sources/types";
import type { DataSourceRegistry } from "@/lib/data-sources/registry";
import { normalizeDataSourcePrefix } from "@/lib/data-sources/inspection-token";

const COLLECTION = "data_sources";

export type { DataSourceAccessGrants } from "./types";

export interface DataSourceDoc {
  id: string;
  kind: "csv";
  orgId: string;
  bucket: string;
  prefix: string;
  credentialRef: CredentialRef;
  credentialEnc?: string;
  ownerColumn: string;
  ownerColumnIdentity?: "email" | "uid";
  accessGrants: DataSourceAccessGrants;
  configVersion: number;
  createdBy: string;
  updatedAt: string;
  name?: string;
}

export type DataSourceMetadata = Omit<
  DataSourceDoc,
  "credentialRef" | "credentialEnc"
>;

export interface CreateDataSourceInput {
  kind: "csv";
  name?: string;
  bucket: string;
  prefix: string;
  credentialRef: CredentialRef;
  credentialEnc?: string;
  ownerColumn: string;
  accessGrants: DataSourceAccessGrants;
}

export type UpdateDataSourcePatch = Partial<CreateDataSourceInput>;

export class DataSourceNotFoundError extends Error {
  readonly status = 404;

  constructor(id: string) {
    super(`Data source not found: ${id}`);
    this.name = "DataSourceNotFoundError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class DataSourceConcurrentModificationError extends Error {
  readonly status = 409;

  constructor(id: string) {
    super(`Data source modified concurrently: ${id}`);
    this.name = "DataSourceConcurrentModificationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export async function listDataSources(): Promise<DataSourceMetadata[]> {
  const snap = await adminDb.collection(COLLECTION).get();
  return snap.docs.map((doc) => toMetadata(toDataSourceDoc(doc.id, doc.data())));
}

export async function getDataSource(
  id: string,
): Promise<DataSourceMetadata | null> {
  const doc = await adminDb.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;

  return toMetadata(toDataSourceDoc(doc.id, doc.data() ?? {}));
}

/**
 * Igual a getDataSource, mas inclui credentialRef (necessario no backend para
 * ler o CSV da fonte via storage GCS). Nunca expor em rotas publicas.
 */
export async function getDataSourceWithCredentials(
  id: string,
): Promise<
  (DataSourceMetadata & { credentialRef: CredentialRef; credentialEnc?: string }) | null
> {
  const doc = await adminDb.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;

  const dataSource = toDataSourceDoc(doc.id, doc.data() ?? {});
  const result: DataSourceMetadata & {
    credentialRef: CredentialRef;
    credentialEnc?: string;
  } = {
    ...toMetadata(dataSource),
    credentialRef: dataSource.credentialRef,
  };
  if (dataSource.credentialEnc !== undefined) {
    result.credentialEnc = dataSource.credentialEnc;
  }
  return result;
}

export async function createDataSource(
  input: CreateDataSourceInput,
  uid: string,
): Promise<DataSourceMetadata> {
  const now = new Date().toISOString();
  const payload = normalizeCreateInput(input, uid, now);
  const docRef = await adminDb.collection(COLLECTION).add(payload);
  await docRef.update({ id: docRef.id });

  return toMetadata({ id: docRef.id, ...payload });
}

export async function updateDataSource(
  id: string,
  patch: UpdateDataSourcePatch,
  options: {
    expectedConfigVersion?: number;
    validateCurrent?: (current: DataSourceDoc) => void;
  } = {},
): Promise<DataSourceMetadata> {
  const docRef = adminDb.collection(COLLECTION).doc(id);

  return adminDb.runTransaction(async (tx) => {
    const doc = await tx.get(docRef);
    if (!doc.exists) {
      throw new DataSourceNotFoundError(id);
    }

    const current = toDataSourceDoc(doc.id, doc.data() ?? {});
    if (
      options.expectedConfigVersion !== undefined &&
      current.configVersion !== options.expectedConfigVersion
    ) {
      throw new DataSourceConcurrentModificationError(id);
    }
    options.validateCurrent?.(current);

    const normalizedPatch = normalizePatch(patch);
    const updates: Partial<DataSourceDoc> = {
      ...normalizedPatch,
      updatedAt: new Date().toISOString(),
    };

    if (hasConfigChanged(current, normalizedPatch)) {
      updates.configVersion = current.configVersion + 1;
    }

    await tx.update(docRef, updates);

    return toMetadata({
      ...current,
      ...updates,
      configVersion: updates.configVersion ?? current.configVersion,
    });
  });
}

export async function deleteDataSource(id: string): Promise<void> {
  const docRef = adminDb.collection(COLLECTION).doc(id);
  const doc = await docRef.get();
  if (!doc.exists) {
    throw new DataSourceNotFoundError(id);
  }

  await docRef.delete();
}

export async function loadDataSourcesIntoRegistry(
  registry: DataSourceRegistry,
): Promise<void> {
  const snap = await adminDb.collection(COLLECTION).get();

  for (const doc of snap.docs) {
    const dataSource = toDataSourceDoc(doc.id, doc.data());
    const registryEntry: DataSource = {
      id: dataSource.id,
      kind: DataSourceKind.CSV,
      orgId: dataSource.orgId,
      configVersion: dataSource.configVersion,
      accessGrants: dataSource.accessGrants,
      ownerColumnIdentity: dataSource.ownerColumnIdentity ?? "email",
    };

    if (dataSource.ownerColumn) {
      registryEntry.ownerColumn = dataSource.ownerColumn;
    }

    registry.register(registryEntry);
  }
}

function normalizeCreateInput(
  input: CreateDataSourceInput,
  uid: string,
  updatedAt: string,
): Omit<DataSourceDoc, "id"> {
  const payload: Omit<DataSourceDoc, "id"> = {
    kind: "csv",
    orgId: process.env.TWD_ORG_ID ?? "",
    bucket: input.bucket.trim(),
    prefix: normalizePrefix(input.prefix),
    credentialRef: normalizeCredentialRef(input.credentialRef),
    ownerColumn: input.ownerColumn.trim(),
    accessGrants: normalizeAccessGrants(input.accessGrants),
    configVersion: 1,
    createdBy: uid,
    updatedAt,
  };

  const name = input.name?.trim();
  if (name) payload.name = name;
  if (input.credentialEnc !== undefined) {
    payload.credentialEnc = input.credentialEnc;
  }

  return payload;
}

function normalizePatch(patch: UpdateDataSourcePatch): UpdateDataSourcePatch {
  const normalized: UpdateDataSourcePatch = {};

  if (patch.kind !== undefined) normalized.kind = "csv";
  if (patch.name !== undefined) normalized.name = patch.name.trim();
  if (patch.bucket !== undefined) normalized.bucket = patch.bucket.trim();
  if (patch.prefix !== undefined) normalized.prefix = normalizePrefix(patch.prefix);
  if (patch.credentialRef !== undefined) {
    normalized.credentialRef = normalizeCredentialRef(patch.credentialRef);
  }
  if (patch.credentialEnc !== undefined) {
    normalized.credentialEnc = patch.credentialEnc;
  }
  if (patch.ownerColumn !== undefined) {
    normalized.ownerColumn = patch.ownerColumn.trim();
  }
  if (patch.accessGrants !== undefined) {
    normalized.accessGrants = normalizeAccessGrants(patch.accessGrants);
  }

  return normalized;
}

function hasConfigChanged(
  current: DataSourceDoc,
  patch: UpdateDataSourcePatch,
): boolean {
  return (
    changed(current.bucket, patch.bucket) ||
    changed(current.prefix, patch.prefix) ||
    changed(current.credentialRef, patch.credentialRef) ||
    changed(current.credentialEnc, patch.credentialEnc) ||
    changed(current.ownerColumn, patch.ownerColumn) ||
    changed(current.accessGrants, patch.accessGrants)
  );
}

function changed(current: unknown, next: unknown): boolean {
  if (next === undefined) return false;
  return JSON.stringify(current) !== JSON.stringify(next);
}

function toDataSourceDoc(
  id: string,
  data: FirebaseFirestore.DocumentData,
): DataSourceDoc {
  const doc: DataSourceDoc = {
    id,
    kind: "csv",
    orgId: typeof data.orgId === "string" ? data.orgId : "",
    bucket: typeof data.bucket === "string" ? data.bucket : "",
    prefix: normalizePrefix(typeof data.prefix === "string" ? data.prefix : ""),
    credentialRef: data.credentialRef as CredentialRef,
    ownerColumn: typeof data.ownerColumn === "string" ? data.ownerColumn : "",
    ownerColumnIdentity: isOwnerColumnIdentity(data.ownerColumnIdentity)
      ? data.ownerColumnIdentity
      : "email",
    accessGrants: normalizeAccessGrants(
      isAccessGrantsLike(data.accessGrants) ? data.accessGrants : undefined,
    ),
    configVersion:
      typeof data.configVersion === "number" ? data.configVersion : 1,
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
    updatedAt:
      typeof data.updatedAt === "string"
        ? data.updatedAt
        : new Date(0).toISOString(),
  };

  if (typeof data.name === "string") doc.name = data.name;
  if (typeof data.credentialEnc === "string") {
    doc.credentialEnc = data.credentialEnc;
  }

  return doc;
}

function toMetadata(doc: DataSourceDoc): DataSourceMetadata {
  const safe: DataSourceMetadata = {
    id: doc.id,
    kind: doc.kind,
    orgId: doc.orgId,
    bucket: doc.bucket,
    prefix: doc.prefix,
    ownerColumn: doc.ownerColumn,
    ownerColumnIdentity: doc.ownerColumnIdentity,
    accessGrants: doc.accessGrants,
    configVersion: doc.configVersion,
    createdBy: doc.createdBy,
    updatedAt: doc.updatedAt,
  };
  if (doc.name !== undefined) safe.name = doc.name;
  return safe;
}

function normalizePrefix(prefix: string): string {
  return normalizeDataSourcePrefix(prefix);
}

function normalizeCredentialRef(ref: CredentialRef): CredentialRef {
  return { kind: ref.kind, ref: ref.ref.trim() };
}

function normalizeAccessGrants(
  grants: DataSourceAccessGrants | undefined,
): DataSourceAccessGrants {
  return {
    assignedUsers: [...(grants?.assignedUsers ?? [])],
    assignedDepartments: [...(grants?.assignedDepartments ?? [])],
  };
}

function isAccessGrantsLike(
  value: unknown,
): value is DataSourceAccessGrants {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as Partial<DataSourceAccessGrants>).assignedUsers) &&
    Array.isArray((value as Partial<DataSourceAccessGrants>).assignedDepartments)
  );
}

function isOwnerColumnIdentity(value: unknown): value is "email" | "uid" {
  return value === "email" || value === "uid";
}
