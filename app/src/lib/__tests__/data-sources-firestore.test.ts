import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataSourceKind, DataSourceRegistry } from "@/lib/data-sources";

type DocData = Record<string, unknown>;
type DocState = { exists: boolean; data: DocData };

const firestoreMocks = vi.hoisted(() => {
  const docs = new Map<string, DocState>();
  let nextId = 1;

  function snapshot(id: string, state: DocState | undefined) {
    return {
      id,
      exists: state?.exists ?? false,
      data: () => state?.data ?? null,
    };
  }

  function docRef(id: string) {
    return {
      id,
      get: vi.fn(async () => snapshot(id, docs.get(id))),
      update: vi.fn(async (patch: DocData) => {
        const current = docs.get(id);
        if (!current?.exists) {
          throw new Error(`Missing data source: ${id}`);
        }
        docs.set(id, {
          exists: true,
          data: { ...current.data, ...patch },
        });
      }),
      delete: vi.fn(async () => {
        docs.delete(id);
      }),
    };
  }

  return {
    docs,
    add: vi.fn(async (data: DocData) => {
      const id = `source-${nextId++}`;
      docs.set(id, { exists: true, data });
      return docRef(id);
    }),
    getCollection: vi.fn(async () => ({
      docs: Array.from(docs.entries()).map(([id, state]) => ({
        id,
        data: () => state.data,
      })),
    })),
    runTransaction: vi.fn(async (fn: (tx: {
      get: (ref: { get: () => Promise<unknown> }) => Promise<unknown>;
      update: (ref: { update: (data: DocData) => Promise<void> }, data: DocData) => Promise<void>;
      delete: (ref: { delete: () => Promise<void> }) => Promise<void>;
    }) => Promise<unknown>) =>
      fn({
        get: (ref) => ref.get(),
        update: (ref, data) => ref.update(data),
        delete: (ref) => ref.delete(),
      })
    ),
    docRef,
    reset: () => {
      docs.clear();
      nextId = 1;
    },
  };
});

vi.mock("@/lib/firebase/admin", () => ({
  adminDb: {
    collection: (name: string) => {
      if (name !== "data_sources") {
        throw new Error(`Unmocked collection: ${name}`);
      }

      return {
        add: firestoreMocks.add,
        doc: (id: string) => firestoreMocks.docRef(id),
        get: firestoreMocks.getCollection,
      };
    },
    runTransaction: firestoreMocks.runTransaction,
  },
}));

const {
  DataSourceNotFoundError,
  createDataSource,
  deleteDataSource,
  loadDataSourcesIntoRegistry,
  updateDataSource,
} = await import("@/lib/data-sources/firestore");

const baseInput = {
  kind: "csv" as const,
  name: "Clientes",
  bucket: "external-bucket",
  prefix: "exports",
  credentialRef: { kind: "encryptedBlob" as const, ref: "credential-a" },
  ownerColumn: "owner_email",
  accessGrants: {
    assignedUsers: ["uid-a"],
    assignedDepartments: ["sales"],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  firestoreMocks.reset();
});

describe("data sources Firestore persistence", () => {
  it("createDataSource define versionamento, autor e prefixo normalizado", async () => {
    vi.stubEnv("TWD_ORG_ID", "org-a");

    const created = await createDataSource(baseInput, "super-uid");
    const stored = firestoreMocks.docs.get(created.id)?.data;

    expect(created).toMatchObject({
      id: "source-1",
      kind: "csv",
      orgId: "org-a",
      configVersion: 1,
      createdBy: "super-uid",
      prefix: "exports/",
    });
    expect(created).not.toHaveProperty("credentialRef");
    expect(created).not.toHaveProperty("credentialEnc");
    expect(stored).toMatchObject({
      id: "source-1",
      kind: "csv",
      orgId: "org-a",
      configVersion: 1,
      createdBy: "super-uid",
      prefix: "exports/",
      credentialRef: baseInput.credentialRef,
    });
  });

  it("normaliza credentialRef removendo espaços externos em create e update", async () => {
    const created = await createDataSource(
      {
        ...baseInput,
        credentialRef: { kind: "encryptedBlob", ref: " credential-a " },
      },
      "super-uid",
    );
    expect(firestoreMocks.docs.get(created.id)?.data.credentialRef).toEqual({
      kind: "encryptedBlob",
      ref: "credential-a",
    });

    await updateDataSource(created.id, {
      credentialRef: { kind: "encryptedBlob", ref: " credential-b " },
      credentialEnc: "secret-b",
    });
    expect(firestoreMocks.docs.get(created.id)?.data.credentialRef).toEqual({
      kind: "encryptedBlob",
      ref: "credential-b",
    });
  });

  it("normaliza prefixo removendo barras iniciais em create e update", async () => {
    const created = await createDataSource({ ...baseInput, prefix: "/exports" }, "super-uid");
    expect(created.prefix).toBe("exports/");
    expect(firestoreMocks.docs.get(created.id)?.data.prefix).toBe("exports/");

    const updated = await updateDataSource(created.id, { prefix: "/daily" });
    expect(updated.prefix).toBe("daily/");
    expect(firestoreMocks.docs.get(created.id)?.data.prefix).toBe("daily/");
  });

  it("rejeita update quando expectedConfigVersion nao bate", async () => {
    const created = await createDataSource(baseInput, "super-uid");
    await expect(
      updateDataSource(created.id, { prefix: "daily" }, { expectedConfigVersion: 999 }),
    ).rejects.toMatchObject({
      name: "DataSourceConcurrentModificationError",
      status: 409,
    });
    expect(firestoreMocks.docs.get(created.id)?.data.configVersion).toBe(1);
  });

  it("updateDataSource incrementa configVersion quando configuração muda", async () => {
    firestoreMocks.docs.set("source-a", {
      exists: true,
      data: {
        ...baseInput,
        id: "source-a",
        orgId: "org-a",
        prefix: "exports/",
        configVersion: 1,
        createdBy: "super-uid",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    });

    const updated = await updateDataSource("source-a", { prefix: "daily" });

    expect(updated.configVersion).toBe(2);
    expect(updated.prefix).toBe("daily/");
    expect(firestoreMocks.docs.get("source-a")?.data).toMatchObject({
      prefix: "daily/",
      configVersion: 2,
    });
  });

  it("updateDataSource não incrementa configVersion quando só metadata muda", async () => {
    firestoreMocks.docs.set("source-a", {
      exists: true,
      data: {
        ...baseInput,
        id: "source-a",
        orgId: "org-a",
        prefix: "exports/",
        configVersion: 7,
        createdBy: "super-uid",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    });

    const updated = await updateDataSource("source-a", { name: "Clientes VIP" });

    expect(updated.configVersion).toBe(7);
    expect(updated.name).toBe("Clientes VIP");
    expect(firestoreMocks.docs.get("source-a")?.data.configVersion).toBe(7);
  });

  it("deleteDataSource lança erro 404 quando o documento não existe", async () => {
    await expect(deleteDataSource("missing")).rejects.toBeInstanceOf(
      DataSourceNotFoundError,
    );
    await expect(deleteDataSource("missing")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("loadDataSourcesIntoRegistry popula o registry e trata kind ausente como csv", async () => {
    firestoreMocks.docs.set("source-a", {
      exists: true,
      data: {
        id: "source-a",
        orgId: "org-a",
        configVersion: 3,
        ownerColumn: "owner_email",
        bucket: "external-bucket",
        prefix: "exports/",
        credentialRef: { kind: "encryptedBlob", ref: "credential-a" },
        accessGrants: { assignedUsers: [], assignedDepartments: [] },
        createdBy: "super-uid",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    });
    const registry = new DataSourceRegistry();

    await loadDataSourcesIntoRegistry(registry);

    expect(registry.get("source-a")).toEqual({
      id: "source-a",
      kind: DataSourceKind.CSV,
      orgId: "org-a",
      configVersion: 3,
      ownerColumn: "owner_email",
      accessGrants: { assignedUsers: [], assignedDepartments: [] },
      ownerColumnIdentity: "email",
    });
  });
});
