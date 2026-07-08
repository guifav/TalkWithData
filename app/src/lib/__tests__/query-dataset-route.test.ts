import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const verifyRequest = vi.fn();

vi.mock("@/lib/api-auth", () => ({
  verifyRequest: (req: Request) => verifyRequest(req),
}));

vi.mock("@/lib/data-sources/firestore", () => ({
  getDataSource: vi.fn(),
  getDataSourceWithCredentials: vi.fn(),
  listDataSources: vi.fn(),
}));

vi.mock("@/lib/data-sources/access", () => ({
  canQueryDataSource: vi.fn(),
  resolveViewerScope: vi.fn(),
}));

vi.mock("@/lib/data-sources/credentials", () => ({
  SecretService: class {
    async resolve() {
      return { projectId: "p", client_email: "e", private_key: "k" };
    }
  },
}));

vi.mock("@/lib/data-sources/storage", () => ({
  createGcsStorage: () => ({
    list: async () => ({
      objects: [{ name: "exports/data.csv", md5Hash: "h1" }],
    }),
    readByKey: async () => ({
      content: Buffer.from("owner,amount\nana,10\nbob,20\n"),
      md5Hash: "h1",
    }),
  }),
}));

import { POST } from "@/app/api/ai/query-dataset/route";
import {
  getDataSource,
  getDataSourceWithCredentials,
} from "@/lib/data-sources/firestore";
import {
  canQueryDataSource,
  resolveViewerScope,
} from "@/lib/data-sources/access";

const DS_META = {
  id: "ds1",
  kind: "csv" as const,
  orgId: "org",
  configVersion: 1,
  ownerColumn: "owner",
  accessGrants: { assignedUsers: ["u1"], assignedDepartments: [] },
  ownerColumnIdentity: "email" as const,
};

const DS_WITH_CREDS = {
  ...DS_META,
  credentialRef: { kind: "encryptedBlob" as const, ref: "r" },
  // O SecretService e mockado neste arquivo, entao o blob nao precisa ser
  // descriptografavel; basta existir para o readDataSourceCsv nao falhar em
  // "sem credentialEnc".
  credentialEnc: "blob-fake-base64",
};

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/ai/query-dataset", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/ai/query-dataset (P1.7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyRequest.mockResolvedValue({ uid: "u1" });
    (getDataSource as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      DS_META,
    );
    (
      getDataSourceWithCredentials as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue(DS_WITH_CREDS);
    (
      canQueryDataSource as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ canQuery: true });
    (
      resolveViewerScope as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ ownerKeys: ["ana"] });
  });

  it("401 quando nao autenticado", async () => {
    verifyRequest.mockResolvedValue(null);
    const res = await POST(makeRequest({ dataSourceId: "ds1", query: "SELECT * FROM view" }));
    expect(res.status).toBe(401);
  });

  it("400 quando faltam campos", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("200 retorna apenas colunas de dados (engine DuckDB real, ownerColumn excluida)", async () => {
    const res = await POST(
      makeRequest({
        dataSourceId: "ds1",
        query: "SELECT * FROM view ORDER BY amount",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.columns).toEqual(["amount"]);
    expect(body.rows).toEqual([[10]]);
    expect(body.truncated).toBe(false);
  });

  it("403 quando canQuery e false (guard P1.4) com mensagem publica", async () => {
    (
      canQueryDataSource as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ canQuery: false });
    const res = await POST(
      makeRequest({ dataSourceId: "ds1", query: "SELECT * FROM view" }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("You do not have access to this data source.");
  });

  it("404 quando a fonte nao existe", async () => {
    (getDataSource as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      null,
    );
    const res = await POST(
      makeRequest({ dataSourceId: "nope", query: "SELECT * FROM view" }),
    );
    expect(res.status).toBe(404);
  });
});
