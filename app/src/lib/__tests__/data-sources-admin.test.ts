import { readFileSync } from "fs";
import { join } from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  createDataSourceInspectionToken,
  credentialEncProof,
  storedCredentialProof,
} from "@/lib/data-sources/inspection-token";

process.env.ALLOWED_AUTH_DOMAIN = "example.com";

type DocData = Record<string, unknown>;
type DocState = { exists: boolean; data: DocData };

const routeMocks = vi.hoisted(() => {
  const dataSources = new Map<string, DocState>();
  const users = new Map<string, DocState>();
  let nextId = 1;
  const verifyIdToken = vi.fn();

  function snapshot(id: string, state: DocState | undefined) {
    return {
      id,
      exists: state?.exists ?? false,
      data: () => state?.data ?? null,
    };
  }

  function dataSourceDocRef(id: string) {
    return {
      id,
      get: vi.fn(async () => snapshot(id, dataSources.get(id))),
      update: vi.fn(async (patch: DocData) => {
        const current = dataSources.get(id);
        if (!current?.exists) {
          throw new Error(`Missing data source: ${id}`);
        }
        dataSources.set(id, {
          exists: true,
          data: { ...current.data, ...patch },
        });
      }),
      delete: vi.fn(async () => {
        dataSources.delete(id);
      }),
    };
  }

  return {
    dataSources,
    users,
    verifyIdToken,
    add: vi.fn(async (data: DocData) => {
      const id = `source-${nextId++}`;
      dataSources.set(id, { exists: true, data });
      return dataSourceDocRef(id);
    }),
    getDataSources: vi.fn(async () => ({
      docs: Array.from(dataSources.entries()).map(([id, state]) => ({
        id,
        data: () => state.data,
      })),
    })),
    docRef: dataSourceDocRef,
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
    reset: () => {
      dataSources.clear();
      users.clear();
      nextId = 1;
      verifyIdToken.mockReset();
    },
  };
});

vi.mock("@/lib/firebase/admin", () => ({
  adminAuth: {
    verifyIdToken: routeMocks.verifyIdToken,
  },
  adminDb: {
    collection: (name: string) => {
      if (name === "users") {
        return {
          doc: (id: string) => ({
            get: async () => ({
              exists: routeMocks.users.has(id),
              data: () => routeMocks.users.get(id)?.data ?? null,
            }),
          }),
        };
      }

      if (name === "data_sources") {
        return {
          add: routeMocks.add,
          doc: (id: string) => routeMocks.docRef(id),
          get: routeMocks.getDataSources,
        };
      }

      throw new Error(`Unmocked collection: ${name}`);
    },
    runTransaction: routeMocks.runTransaction,
  },
}));

const { GET: listDataSources, POST: createDataSource } = await import(
  "@/app/api/admin/data-sources/route"
);
const {
  GET: getDataSource,
  PATCH: updateDataSource,
  DELETE: deleteDataSource,
} = await import("@/app/api/admin/data-sources/[id]/route");

function request(
  method: string,
  url: string,
  token: string | null,
  body?: unknown,
): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  return new NextRequest(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function setupAuth(role: "user" | "admin" | "superadmin") {
  routeMocks.verifyIdToken.mockResolvedValue({
    uid: `uid-${role}`,
    email: `${role}@example.com`,
    name: `Test ${role}`,
  });
  routeMocks.users.set(`uid-${role}`, { exists: true, data: { role } });
}

function validPayload(overrides: DocData = {}) {
  const base: DocData = {
    kind: "csv",
    name: "Clientes",
    bucket: "external-bucket",
    prefix: "exports",
    credentialRef: { kind: "encryptedBlob", ref: "credential-a" },
    credentialEnc: "encrypted-secret-base64",
    ownerColumn: "owner_email",
    accessGrants: {
      assignedUsers: ["uid-a"],
      assignedDepartments: ["sales"],
    },
    ...overrides,
  };
  return {
    ...base,
    inspectionToken:
      typeof base.inspectionToken === "string"
        ? base.inspectionToken
        : createDataSourceInspectionToken({
            bucket: String(base.bucket),
            prefix: String(base.prefix),
            credentialRef: base.credentialRef as { kind: "encryptedBlob"; ref: string },
            credentialProof: credentialEncProof(String(base.credentialEnc ?? "")),
            headers: ["owner_email", "amount"],
            duplicateIdentities: [],
          }),
  };
}

async function jsonBody(response: Response): Promise<DocData> {
  return (await response.json()) as DocData;
}

function storedInspectionToken(args: {
  dataSourceId: string;
  configVersion: number;
  bucket: string;
  prefix: string;
  credentialRef: { kind: "encryptedBlob"; ref: string };
  ownerColumn: string;
  headers?: string[];
}) {
  return createDataSourceInspectionToken({
    bucket: args.bucket,
    prefix: args.prefix,
    credentialRef: args.credentialRef,
    credentialProof: storedCredentialProof({
      dataSourceId: args.dataSourceId,
      configVersion: args.configVersion,
      credentialRef: args.credentialRef,
    }),
    headers: args.headers ?? [args.ownerColumn, "amount"],
    duplicateIdentities: [],
  });
}

function inlineInspectionToken(args: {
  bucket: string;
  prefix: string;
  credentialRef: { kind: "encryptedBlob"; ref: string };
  credentialEnc: string;
  ownerColumn: string;
  dataSourceId?: string;
  configVersion?: number;
}) {
  return createDataSourceInspectionToken({
    bucket: args.bucket,
    prefix: args.prefix,
    credentialRef: args.credentialRef,
    credentialProof:
      args.dataSourceId !== undefined && args.configVersion !== undefined
        ? credentialEncProof(args.credentialEnc, {
            dataSourceId: args.dataSourceId,
            configVersion: args.configVersion,
          })
        : credentialEncProof(args.credentialEnc),
    headers: [args.ownerColumn, "amount"],
    duplicateIdentities: [],
  });
}

beforeEach(() => {
  routeMocks.reset();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  process.env.ALLOWED_AUTH_DOMAIN = "example.com";
  delete process.env.TWD_ORG_ID;
  delete process.env.TWD_INSPECTION_TOKEN_SECRET;
  delete process.env.DASHBOARD_SESSION_SECRET;
});

describe("admin data sources routes", () => {
  it("superadmin cria, lista e atualiza sem expor credenciais", async () => {
    setupAuth("superadmin");
    const createRes = await createDataSource(
      request(
        "POST",
        "http://localhost/api/admin/data-sources",
        "token",
        validPayload({ credentialEnc: " encrypted-secret-base64 " }),
      ),
    );
    const created = await jsonBody(createRes);

    expect(createRes.status).toBe(200);
    expect(created).toMatchObject({
      id: "source-1",
      kind: "csv",
      bucket: "external-bucket",
      prefix: "exports/",
      configVersion: 1,
    });
    expect(JSON.stringify(created)).not.toContain("credentialRef");
    expect(JSON.stringify(created)).not.toContain("credentialEnc");
    expect(routeMocks.dataSources.get("source-1")?.data.credentialEnc).toBe(
      "encrypted-secret-base64",
    );

    routeMocks.dataSources.set("source-secret", {
      exists: true,
      data: {
        ...validPayload(),
        id: "source-secret",
        orgId: "",
        prefix: "secret/",
        credentialEnc: "sensitive-base64",
        configVersion: 1,
        createdBy: "uid-superadmin",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    });

    const listRes = await listDataSources(
      request("GET", "http://localhost/api/admin/data-sources", "token"),
    );
    const listed = await jsonBody(listRes);

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listed.dataSources)).toBe(true);
    expect(JSON.stringify(listed)).not.toContain("credentialRef");
    expect(JSON.stringify(listed)).not.toContain("credentialEnc");
    expect(JSON.stringify(listed)).not.toContain("sensitive-base64");

    const patchRes = await updateDataSource(
      request(
        "PATCH",
        "http://localhost/api/admin/data-sources/source-1",
        "token",
        {
          name: "Clientes VIP",
          prefix: "daily",
          credentialEnc: "updated-secret",
          inspectionToken: inlineInspectionToken({
            dataSourceId: "source-1",
            configVersion: 1,
            bucket: "external-bucket",
            prefix: "daily",
            credentialRef: { kind: "encryptedBlob", ref: "credential-a" },
            credentialEnc: "updated-secret",
            ownerColumn: "owner_email",
          }),
        },
      ),
      { params: Promise.resolve({ id: "source-1" }) },
    );
    const patched = await jsonBody(patchRes);

    expect(patchRes.status).toBe(200);
    expect(patched).toMatchObject({
      id: "source-1",
      name: "Clientes VIP",
      prefix: "daily/",
      configVersion: 2,
    });
    expect(JSON.stringify(patched)).not.toContain("credentialRef");
    expect(JSON.stringify(patched)).not.toContain("credentialEnc");
    expect(JSON.stringify(patched)).not.toContain("updated-secret");
    expect(routeMocks.dataSources.get("source-1")?.data.credentialEnc).toBe(
      "updated-secret",
    );
  });

  it.each(["admin", "user"] as const)(
    "bloqueia papel %s com 403",
    async (role) => {
      setupAuth(role);

      const res = await listDataSources(
        request("GET", "http://localhost/api/admin/data-sources", "token"),
      );

      expect(res.status).toBe(403);
    },
  );

  it("PATCH parcial incrementa configVersion quando campo de configuração muda", async () => {
    setupAuth("superadmin");
    routeMocks.dataSources.set("source-a", {
      exists: true,
      data: {
        ...validPayload(),
        id: "source-a",
        orgId: "",
        prefix: "exports/",
        configVersion: 4,
        createdBy: "uid-superadmin",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    });

    const res = await updateDataSource(
      request("PATCH", "http://localhost/api/admin/data-sources/source-a", "token", {
        ownerColumn: "account_owner",
        inspectionToken: storedInspectionToken({
          dataSourceId: "source-a",
          configVersion: 4,
          bucket: "external-bucket",
          prefix: "exports/",
          credentialRef: { kind: "encryptedBlob", ref: "credential-a" },
          ownerColumn: "account_owner",
        }),
      }),
      { params: Promise.resolve({ id: "source-a" }) },
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.configVersion).toBe(5);
    expect(body.ownerColumn).toBe("account_owner");
  });

  it("rejeita create sem inspectionToken server-side", async () => {
    setupAuth("superadmin");
    const { inspectionToken: _inspectionToken, ...payload } = validPayload();
    void _inspectionToken;

    const res = await createDataSource(
      request("POST", "http://localhost/api/admin/data-sources", "token", payload),
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(400);
    expect(body.error).toBe("inspectionToken is required");
    expect(routeMocks.add).not.toHaveBeenCalled();
  });

  it("rejeita create quando ownerColumn nao veio dos headers inspecionados", async () => {
    setupAuth("superadmin");
    const payload = validPayload({
      ownerColumn: "wrong_owner",
      inspectionToken: createDataSourceInspectionToken({
        bucket: "external-bucket",
        prefix: "exports",
        credentialRef: { kind: "encryptedBlob", ref: "credential-a" },
        credentialProof: credentialEncProof("encrypted-secret-base64"),
        headers: ["owner_email", "amount"],
        duplicateIdentities: [],
      }),
    });

    const res = await createDataSource(
      request("POST", "http://localhost/api/admin/data-sources", "token", payload),
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(400);
    expect(body.error).toBe("ownerColumn was not inspected");
    expect(routeMocks.add).not.toHaveBeenCalled();
  });

  it("aceita ownerColumn com header inspecionado que tinha espaços externos", async () => {
    setupAuth("superadmin");
    const payload = validPayload({
      ownerColumn: " owner_email ",
      inspectionToken: createDataSourceInspectionToken({
        bucket: "external-bucket",
        prefix: "exports",
        credentialRef: { kind: "encryptedBlob", ref: "credential-a" },
        credentialProof: credentialEncProof("encrypted-secret-base64"),
        headers: [" owner_email ", "amount"],
        duplicateIdentities: [],
      }),
    });

    const res = await createDataSource(
      request("POST", "http://localhost/api/admin/data-sources", "token", payload),
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.ownerColumn).toBe("owner_email");
  });

  it("falha fechado em production sem segredo de assinatura de inspectionToken", async () => {
    setupAuth("superadmin");
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.TWD_INSPECTION_TOKEN_SECRET;
    delete process.env.DASHBOARD_SESSION_SECRET;
    expect(() => createDataSourceInspectionToken({
      bucket: "external-bucket",
      prefix: "exports",
      credentialRef: { kind: "encryptedBlob", ref: "credential-a" },
      credentialProof: credentialEncProof("encrypted-secret-base64"),
      headers: ["owner_email", "amount"],
      duplicateIdentities: [],
    })).toThrow("TWD_INSPECTION_TOKEN_SECRET or DASHBOARD_SESSION_SECRET is required in production");
  });

  it("rejeita PATCH de campo critico com token stale", async () => {
    setupAuth("superadmin");
    routeMocks.dataSources.set("source-stale", {
      exists: true,
      data: {
        ...validPayload(),
        id: "source-stale",
        orgId: "",
        prefix: "exports/",
        credentialEnc: "encrypted-secret-base64",
        configVersion: 3,
        createdBy: "uid-superadmin",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    });

    const res = await updateDataSource(
      request("PATCH", "http://localhost/api/admin/data-sources/source-stale", "token", {
        prefix: "daily",
        inspectionToken: storedInspectionToken({
          dataSourceId: "source-stale",
          configVersion: 2,
          bucket: "external-bucket",
          prefix: "daily",
          credentialRef: { kind: "encryptedBlob", ref: "credential-a" },
          ownerColumn: "owner_email",
        }),
      }),
      { params: Promise.resolve({ id: "source-stale" }) },
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(409);
    expect(body.error).toBe("Data source was modified concurrently; inspect headers again");
  });

  it("rejeita PATCH com credentialEnc novo quando token inline ficou stale", async () => {
    setupAuth("superadmin");
    routeMocks.dataSources.set("source-inline-stale", {
      exists: true,
      data: {
        ...validPayload(),
        id: "source-inline-stale",
        orgId: "",
        prefix: "exports/",
        credentialEnc: "encrypted-secret-base64",
        configVersion: 4,
        createdBy: "uid-superadmin",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    });

    const res = await updateDataSource(
      request("PATCH", "http://localhost/api/admin/data-sources/source-inline-stale", "token", {
        credentialEnc: "new-encrypted-secret-base64",
        credentialRef: { kind: "encryptedBlob", ref: "credential-b" },
        inspectionToken: inlineInspectionToken({
          dataSourceId: "source-inline-stale",
          configVersion: 3,
          bucket: "external-bucket",
          prefix: "exports",
          credentialRef: { kind: "encryptedBlob", ref: "credential-b" },
          credentialEnc: "new-encrypted-secret-base64",
          ownerColumn: "owner_email",
        }),
      }),
      { params: Promise.resolve({ id: "source-inline-stale" }) },
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(409);
    expect(body.error).toBe("Data source was modified concurrently; inspect headers again");
    expect(routeMocks.dataSources.get("source-inline-stale")?.data.credentialEnc).toBe(
      "encrypted-secret-base64",
    );
  });

  it("rejeita PATCH com stored token stale quando credencial mudou concorrentemente", async () => {
    setupAuth("superadmin");
    routeMocks.dataSources.set("source-stored-stale", {
      exists: true,
      data: {
        ...validPayload(),
        id: "source-stored-stale",
        orgId: "",
        prefix: "exports/",
        credentialRef: { kind: "encryptedBlob", ref: "credential-b" },
        credentialEnc: "rotated-secret-base64",
        configVersion: 4,
        createdBy: "uid-superadmin",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    });

    const res = await updateDataSource(
      request("PATCH", "http://localhost/api/admin/data-sources/source-stored-stale", "token", {
        prefix: "daily",
        inspectionToken: storedInspectionToken({
          dataSourceId: "source-stored-stale",
          configVersion: 3,
          bucket: "external-bucket",
          prefix: "daily",
          credentialRef: { kind: "encryptedBlob", ref: "credential-a" },
          ownerColumn: "owner_email",
        }),
      }),
      { params: Promise.resolve({ id: "source-stored-stale" }) },
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(409);
    expect(body.error).toBe("Data source was modified concurrently; inspect headers again");
    expect(routeMocks.dataSources.get("source-stored-stale")?.data.prefix).toBe("exports/");
  });

  it("rejeita PATCH critico se configVersion mudar entre inspeção e commit", async () => {
    setupAuth("superadmin");
    routeMocks.dataSources.set("source-race", {
      exists: true,
      data: {
        ...validPayload(),
        id: "source-race",
        orgId: "",
        prefix: "exports/",
        credentialEnc: "encrypted-secret-base64",
        configVersion: 3,
        createdBy: "uid-superadmin",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    });
    routeMocks.runTransaction.mockImplementationOnce(async (fn) => {
      const current = routeMocks.dataSources.get("source-race");
      routeMocks.dataSources.set("source-race", {
        exists: true,
        data: {
          ...(current?.data ?? {}),
          prefix: "other/",
          configVersion: 4,
        },
      });
      return fn({
        get: (ref) => ref.get(),
        update: (ref, data) => ref.update(data),
        delete: (ref) => ref.delete(),
      });
    });

    const res = await updateDataSource(
      request("PATCH", "http://localhost/api/admin/data-sources/source-race", "token", {
        prefix: "daily",
        inspectionToken: storedInspectionToken({
          dataSourceId: "source-race",
          configVersion: 3,
          bucket: "external-bucket",
          prefix: "daily",
          credentialRef: { kind: "encryptedBlob", ref: "credential-a" },
          ownerColumn: "owner_email",
        }),
      }),
      { params: Promise.resolve({ id: "source-race" }) },
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(409);
    expect(body.error).toBe("Data source was modified concurrently; inspect headers again");
    expect(routeMocks.dataSources.get("source-race")?.data.prefix).toBe("other/");
  });

  it("permite PATCH de metadata sem inspectionToken", async () => {
    setupAuth("superadmin");
    routeMocks.dataSources.set("source-meta", {
      exists: true,
      data: {
        ...validPayload(),
        id: "source-meta",
        orgId: "",
        prefix: "exports/",
        configVersion: 7,
        createdBy: "uid-superadmin",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    });

    const res = await updateDataSource(
      request("PATCH", "http://localhost/api/admin/data-sources/source-meta", "token", {
        name: "Only metadata",
      }),
      { params: Promise.resolve({ id: "source-meta" }) },
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ name: "Only metadata", configVersion: 7 });
  });

  it("DELETE remove documento e retorna 404 no segundo delete", async () => {
    setupAuth("superadmin");
    routeMocks.dataSources.set("source-a", {
      exists: true,
      data: {
        ...validPayload(),
        id: "source-a",
        orgId: "",
        prefix: "exports/",
        configVersion: 1,
        createdBy: "uid-superadmin",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    });

    const first = await deleteDataSource(
      request("DELETE", "http://localhost/api/admin/data-sources/source-a", "token"),
      { params: Promise.resolve({ id: "source-a" }) },
    );
    const second = await deleteDataSource(
      request("DELETE", "http://localhost/api/admin/data-sources/source-a", "token"),
      { params: Promise.resolve({ id: "source-a" }) },
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(404);
  });

  it("rejeita campo fora da allowlist com 400", async () => {
    setupAuth("superadmin");

    const res = await createDataSource(
      request("POST", "http://localhost/api/admin/data-sources", "token", {
        ...validPayload(),
        apiKey: "forbidden",
      }),
    );

    expect(res.status).toBe(400);
  });

  it("rejeita assignedDepartments em formato inválido com 400", async () => {
    setupAuth("superadmin");

    const res = await createDataSource(
      request("POST", "http://localhost/api/admin/data-sources", "token", {
        ...validPayload({
          accessGrants: {
            assignedUsers: ["uid-a"],
            assignedDepartments: "sales",
          },
        }),
      }),
    );

    expect(res.status).toBe(400);
  });

  it("rejeita kind diferente de csv com 400", async () => {
    setupAuth("superadmin");

    const res = await createDataSource(
      request("POST", "http://localhost/api/admin/data-sources", "token", {
        ...validPayload({ kind: "postgres" }),
      }),
    );

    expect(res.status).toBe(400);
  });

  it("GET detalhe retorna 404 quando o documento não existe", async () => {
    setupAuth("superadmin");

    const res = await getDataSource(
      request("GET", "http://localhost/api/admin/data-sources/missing", "token"),
      { params: Promise.resolve({ id: "missing" }) },
    );

    expect(res.status).toBe(404);
  });
});

describe("firestore.rules", () => {
  it("bloqueia acesso cliente a data_sources", () => {
    const rules = readFileSync(join(process.cwd(), "..", "firestore.rules"), "utf8");

    expect(rules).toMatch(
      /match\s+\/data_sources\/\{id\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;\s*\}/,
    );
  });
});
