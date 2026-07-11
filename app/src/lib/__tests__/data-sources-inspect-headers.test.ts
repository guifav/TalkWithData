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
  const encrypt = vi.fn((value: object) => {
    void value;
    return Buffer.from("generated-ciphertext");
  });

  return {
    dataSources,
    users,
    verifyIdToken,
    list,
    readPrefix,
    resolve,
    encrypt,
    reset: () => {
      dataSources.clear();
      users.clear();
      verifyIdToken.mockReset();
      list.mockClear();
      readPrefix.mockClear();
      resolve.mockClear();
      encrypt.mockClear();
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
    constructor(opts?: unknown) {
      void opts;
    }

    encrypt(value: object) {
      return routeMocks.encrypt(value);
    }

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
  const rawCredential = {
    type: "service_account",
    project_id: "external-project",
    client_email: "source@example.test",
    private_key: "private-key-material",
  };

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

  it("criptografa credencial bruta durante inspeção sem retornar plaintext", async () => {
    setupAuth("superadmin");

    const response = await inspectHeaders(
      request("token", {
        bucket: "external-bucket",
        prefix: "exports",
        credentialRef: { kind: "encryptedBlob", ref: "credential-a" },
        credential: rawCredential,
      }),
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(routeMocks.encrypt).toHaveBeenCalledWith(rawCredential);
    expect(body.credentialEnc).toBe(Buffer.from("generated-ciphertext").toString("base64"));
    expect(JSON.stringify(body)).not.toContain(rawCredential.private_key);
    expect(JSON.stringify(body)).not.toContain(rawCredential.client_email);
    expect(typeof body.inspectionToken).toBe("string");
  });

  it("não inclui credencial em logs quando a inspeção falha", async () => {
    setupAuth("superadmin");
    routeMocks.resolve.mockRejectedValueOnce(
      new Error(`dependency failure: ${rawCredential.private_key}`),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await inspectHeaders(
      request("token", {
        bucket: "external-bucket",
        prefix: "exports",
        credentialRef: { kind: "encryptedBlob", ref: "credential-a" },
        credential: rawCredential,
      }),
    );
    const body = await response.json();
    const logged = errorSpy.mock.calls.flat().map(String).join("\n");
    errorSpy.mockRestore();

    expect(response.status).toBe(503);
    expect(body).toEqual({ error: "Failed to inspect headers" });
    expect(logged).not.toContain(rawCredential.private_key);
    expect(logged).not.toContain(rawCredential.client_email);
    expect(logged).not.toContain(Buffer.from("generated-ciphertext").toString("base64"));
  });

  it.each([
    ["array", []],
    ["tipo inválido", { ...rawCredential, type: "user" }],
    ["project_id ausente", { ...rawCredential, project_id: "" }],
    ["client_email ausente", { ...rawCredential, client_email: "" }],
    ["private_key ausente", { ...rawCredential, private_key: "" }],
  ])("rejeita credencial bruta com formato inválido: %s", async (_label, credential) => {
    setupAuth("superadmin");

    const response = await inspectHeaders(
      request("token", {
        bucket: "external-bucket",
        prefix: "exports",
        credentialRef: { kind: "encryptedBlob", ref: "credential-a" },
        credential,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("credential must be a valid service account JSON object");
    expect(routeMocks.encrypt).not.toHaveBeenCalled();
  });

  it("rejeita credencial bruta maior que 64 KiB", async () => {
    setupAuth("superadmin");

    const response = await inspectHeaders(
      request("token", {
        bucket: "external-bucket",
        prefix: "exports",
        credentialRef: { kind: "encryptedBlob", ref: "credential-a" },
        credential: { ...rawCredential, private_key: "x".repeat(64 * 1024) },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("credential exceeds the 64 KiB limit");
    expect(routeMocks.encrypt).not.toHaveBeenCalled();
  });

  it("rejeita credencial bruta junto com ciphertext", async () => {
    setupAuth("superadmin");

    const response = await inspectHeaders(
      request("token", {
        bucket: "external-bucket",
        prefix: "exports",
        credentialRef: { kind: "encryptedBlob", ref: "credential-a" },
        credential: rawCredential,
        credentialEnc: "existing-ciphertext",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("credential and credentialEnc are mutually exclusive");
    expect(routeMocks.encrypt).not.toHaveBeenCalled();
  });

  it("valida configuração da fonte antes de criptografar credencial", async () => {
    setupAuth("superadmin");

    const response = await inspectHeaders(
      request("token", {
        prefix: "exports",
        credentialRef: { kind: "encryptedBlob", ref: "credential-a" },
        credential: rawCredential,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("bucket is required");
    expect(routeMocks.encrypt).not.toHaveBeenCalled();
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
