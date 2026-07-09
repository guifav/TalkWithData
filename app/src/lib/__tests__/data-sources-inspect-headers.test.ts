import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

process.env.ALLOWED_AUTH_DOMAIN = "example.com";

type DocData = Record<string, unknown>;
type DocState = { exists: boolean; data: DocData };

const routeMocks = vi.hoisted(() => {
  const dataSources = new Map<string, DocState>();
  const users = new Map<string, DocState>();
  const verifyIdToken = vi.fn();
  const list = vi.fn(async () => ({
    objects: [{ name: "exports/sample.csv", md5Hash: "etag-a" }],
  }));
  const readPrefix = vi.fn(async () =>
    Buffer.from("owner_email,owner email,amount\nana@example.com,ana@example.com,10\n"),
  );
  const resolve = vi.fn(async () => ({ project_id: "test-project" }));

  return {
    dataSources,
    users,
    verifyIdToken,
    list,
    readPrefix,
    resolve,
    reset: () => {
      dataSources.clear();
      users.clear();
      verifyIdToken.mockReset();
      list.mockClear();
      readPrefix.mockClear();
      resolve.mockClear();
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
          doc: (id: string) => ({
            get: async () => ({
              id,
              exists: routeMocks.dataSources.has(id),
              data: () => routeMocks.dataSources.get(id)?.data ?? null,
            }),
          }),
        };
      }
      throw new Error(`Unmocked collection: ${name}`);
    },
  },
}));

vi.mock("@/lib/data-sources/credentials", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data-sources/credentials")>();
  class SecretService {
    async resolve() {
      return routeMocks.resolve();
    }
  }
  return { ...actual, SecretService };
});

vi.mock("@/lib/data-sources/storage", () => ({
  createGcsStorage: vi.fn(() => ({
    list: routeMocks.list,
    readPrefix: routeMocks.readPrefix,
  })),
}));

const { POST: inspectHeaders } = await import(
  "@/app/api/admin/data-sources/inspect-headers/route"
);

function request(token: string | null, body: unknown): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  return new NextRequest("http://localhost/api/admin/data-sources/inspect-headers", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
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

beforeEach(() => {
  routeMocks.reset();
  vi.clearAllMocks();
  process.env.ALLOWED_AUTH_DOMAIN = "example.com";
});

describe("admin inspect data source headers route", () => {
  it("bloqueia admin comum", async () => {
    setupAuth("admin");

    const response = await inspectHeaders(
      request("token", {
        bucket: "external-bucket",
        prefix: "exports/",
        credentialRef: { kind: "encryptedBlob", ref: "credential-a" },
        credentialEnc: "secret-base64",
      }),
    );

    expect(response.status).toBe(403);
    expect(routeMocks.list).not.toHaveBeenCalled();
  });

  it("inspeciona headers sem retornar credencial e marca duplicatas normalizadas", async () => {
    setupAuth("superadmin");

    const response = await inspectHeaders(
      request("token", {
        bucket: "external-bucket",
        prefix: "exports",
        credentialRef: { kind: "encryptedBlob", ref: "credential-a" },
        credentialEnc: "secret-base64",
      }),
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.headers).toEqual(["owner_email", "owner email", "amount"]);
    expect(body.duplicateIdentities).toEqual(["owner_email"]);
    expect(typeof body.inspectionToken).toBe("string");
    expect(String(body.inspectionToken).length).toBeGreaterThan(40);
    const decodedTokenPayload = JSON.parse(
      Buffer.from(String(body.inspectionToken).split(".")[0], "base64url").toString("utf8"),
    );
    expect(JSON.stringify(decodedTokenPayload)).not.toContain("credentialRef");
    expect(JSON.stringify(decodedTokenPayload)).not.toContain("credential-a");
    expect(JSON.stringify(decodedTokenPayload)).not.toContain("secret-base64");
    expect(JSON.stringify(body)).not.toContain("secret-base64");
    expect(routeMocks.list).toHaveBeenCalledWith("exports/", { maxResults: 25 });
    expect(routeMocks.readPrefix).toHaveBeenCalledWith("exports/sample.csv", 64 * 1024);
  });

  it("usa credencial server-only de uma fonte existente", async () => {
    setupAuth("superadmin");
    routeMocks.dataSources.set("source-1", {
      exists: true,
      data: {
        id: "source-1",
        kind: "csv",
        orgId: "",
        bucket: "external-bucket",
        prefix: "daily/",
        credentialRef: { kind: "encryptedBlob", ref: "credential-existing" },
        credentialEnc: "stored-secret-base64",
        ownerColumn: "owner_email",
        accessGrants: { assignedUsers: [], assignedDepartments: [] },
        configVersion: 1,
        createdBy: "uid-superadmin",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    });

    const response = await inspectHeaders(request("token", { dataSourceId: "source-1" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.headers).toEqual(["owner_email", "owner email", "amount"]);
    expect(JSON.stringify(body)).not.toContain("stored-secret-base64");
    expect(routeMocks.list).toHaveBeenCalledWith("daily/", { maxResults: 25 });
  });

  it("emite token inline versionado ao inspecionar edição com credencial nova", async () => {
    setupAuth("superadmin");
    routeMocks.dataSources.set("source-1", {
      exists: true,
      data: {
        id: "source-1",
        kind: "csv",
        orgId: "",
        bucket: "external-bucket",
        prefix: "daily/",
        credentialRef: { kind: "encryptedBlob", ref: "credential-existing" },
        credentialEnc: "stored-secret-base64",
        ownerColumn: "owner_email",
        accessGrants: { assignedUsers: [], assignedDepartments: [] },
        configVersion: 7,
        createdBy: "uid-superadmin",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    });

    const response = await inspectHeaders(
      request("token", {
        dataSourceId: "source-1",
        bucket: "external-bucket",
        prefix: "daily",
        credentialRef: { kind: "encryptedBlob", ref: "credential-new" },
        credentialEnc: "new-secret-base64",
      }),
    );
    const body = await response.json();
    const decodedTokenPayload = JSON.parse(
      Buffer.from(String(body.inspectionToken).split(".")[0], "base64url").toString("utf8"),
    );

    expect(response.status).toBe(200);
    expect(decodedTokenPayload.credentialProof).toMatchObject({
      kind: "inline",
      dataSourceId: "source-1",
      configVersion: 7,
    });
    expect(JSON.stringify(decodedTokenPayload)).not.toContain("credential-new");
    expect(JSON.stringify(decodedTokenPayload)).not.toContain("new-secret-base64");
  });
});
