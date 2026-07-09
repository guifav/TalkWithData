import { readFileSync } from "fs";
import { join } from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

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
  return {
    kind: "csv",
    name: "Clientes",
    bucket: "external-bucket",
    prefix: "exports",
    credentialRef: { kind: "encryptedBlob", ref: "credential-a" },
    ownerColumn: "owner_email",
    accessGrants: {
      assignedUsers: ["uid-a"],
      assignedDepartments: ["sales"],
    },
    ...overrides,
  };
}

async function jsonBody(response: Response): Promise<DocData> {
  return (await response.json()) as DocData;
}

beforeEach(() => {
  routeMocks.reset();
  vi.clearAllMocks();
  process.env.ALLOWED_AUTH_DOMAIN = "example.com";
  delete process.env.TWD_ORG_ID;
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
        { name: "Clientes VIP", prefix: "daily", credentialEnc: "updated-secret" },
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
      }),
      { params: Promise.resolve({ id: "source-a" }) },
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.configVersion).toBe(5);
    expect(body.ownerColumn).toBe("account_owner");
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
