import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/data-sources/firestore", () => ({
  getDataSource: vi.fn(),
  getDataSourceWithCredentials: vi.fn(),
}));
vi.mock("@/lib/data-sources/access", () => ({
  canQueryDataSource: vi.fn(),
  resolveViewerScope: vi.fn(),
}));

import { getDataSource } from "@/lib/data-sources/firestore";
import {
  canQueryDataSource,
  resolveViewerScope,
} from "@/lib/data-sources/access";
import { queryDataset, type ReadCsvResult } from "@/lib/data-sources/query";

const CSV = Buffer.from("owner,amount\nana,10\nbob,20\nx,30\n");

function mockCsv(): ReadCsvResult {
  return { csvBuffer: CSV, etag: "etag-test" };
}

const DS_META = {
  id: "ds1",
  kind: "csv" as const,
  orgId: "org",
  configVersion: 1,
  ownerColumn: "owner",
  accessGrants: { assignedUsers: ["u1"], assignedDepartments: [] },
  ownerColumnIdentity: "email" as const,
};

describe("queryDataset (P1.7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getDataSource as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      DS_META,
    );
    (
      canQueryDataSource as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ canQuery: true });
    (
      resolveViewerScope as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ ownerKeys: ["ana"] });
  });

  it("retorna apenas as colunas de dados (ownerColumn EXCLUIDA da view)", async () => {
    const result = await queryDataset(
      {
        uid: "u1",
        dataSourceId: "ds1",
        sql: "SELECT * FROM view ORDER BY amount",
      },
      { readCsv: async () => mockCsv() },
    );
    // ownerColumn nunca aparece no resultado (defesa em profundidade)
    expect(result.columns).toEqual(["amount"]);
    expect(result.rows).toEqual([[10]]);
    expect(result.truncated).toBe(false);
  });

  it("nega acesso quando canQuery e false (P1.4 guard)", async () => {
    (
      canQueryDataSource as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ canQuery: false });
    await expect(
      queryDataset(
        { uid: "u2", dataSourceId: "ds1", sql: "SELECT * FROM view" },
        { readCsv: async () => mockCsv() },
      ),
    ).rejects.toThrow(/Acesso negado/);
  });

  it("propaga erro quando a fonte nao existe", async () => {
    (getDataSource as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      null,
    );
    await expect(
      queryDataset(
        { uid: "u1", dataSourceId: "nope", sql: "SELECT * FROM view" },
        { readCsv: async () => mockCsv() },
      ),
    ).rejects.toThrow(/nao encontrada/);
  });

  it("bloqueia SQL nao autorizado pelo guardSql (DROP)", async () => {
    await expect(
      queryDataset(
        { uid: "u1", dataSourceId: "ds1", sql: "DROP TABLE view" },
        { readCsv: async () => mockCsv() },
      ),
    ).rejects.toBeDefined();
  });

  it("aplica row cap e sinaliza truncated", async () => {
    (
      resolveViewerScope as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ ownerKeys: ["ana", "bob", "x"] });
    process.env.TWD_MAX_ROWS = "1";
    try {
      const result = await queryDataset(
        {
          uid: "u1",
          dataSourceId: "ds1",
          sql: "SELECT amount FROM view ORDER BY amount",
        },
        { readCsv: async () => mockCsv() },
      );
      expect(result.rows.length).toBe(1);
      expect(result.truncated).toBe(true);
    } finally {
      delete process.env.TWD_MAX_ROWS;
    }
  });

  it("falha ao tentar selecionar a ownerColumn (coluna inexistente na view)", async () => {
    await expect(
      queryDataset(
        {
          uid: "u1",
          dataSourceId: "ds1",
          sql: "SELECT owner FROM view",
        },
        { readCsv: async () => mockCsv() },
      ),
    ).rejects.toBeDefined();
  });

  it("nao vaza ownerColumn com header duplicado (falha fechado)", async () => {
    // CSV com "owner,owner,amount": o csv-table gera safeNames owner/owner_2,
    // mas ambos tem rawName "owner". A view filtrada deve excluir TODAS as
    // colunas de escopo, nunca expondo owner_2. Aqui falhamos fechado porque
    // ha multiplas colunas de escopo.
    const dupCsv = Buffer.from("owner,owner,amount\nana,ana,10\n");
    await expect(
      queryDataset(
        { uid: "u1", dataSourceId: "ds1", sql: "SELECT * FROM view" },
        { readCsv: async () => ({ csvBuffer: dupCsv, etag: "etag-dup" }) },
      ),
    ).rejects.toThrow(/multiplas colunas de escopo/);
  });

  it("nao corrompe coluna legitima chamada 'view' no rewrite", async () => {
    // CSV com coluna de dados chamada "view" (rawName diferente de ownerColumn).
    // O replace de tabela so troca FROM/JOIN view, nao a coluna selecionada.
    const viewColCsv = Buffer.from("owner,view\nana,42\n");
    const result = await queryDataset(
      {
        uid: "u1",
        dataSourceId: "ds1",
        sql: "SELECT view FROM view",
      },
      { readCsv: async () => ({ csvBuffer: viewColCsv, etag: "etag-view" }) },
    );
    expect(result.columns).toEqual(["view"]);
    expect(result.rows).toEqual([[42]]);
  });

  it("falha fechado se ownerColumn declarada ausente no CSV", async () => {
    // A fonte declara ownerColumn "owner", mas o CSV so tem "amount".
    // Sem ownerColumn valido a view cairia em SELECT * e vazaria o schema
    // bruto; falhamos fechado antes de criar a view.
    const noOwnerCsv = Buffer.from("amount\n10\n20\n");
    await expect(
      queryDataset(
        { uid: "u1", dataSourceId: "ds1", sql: "SELECT * FROM view" },
        { readCsv: async () => ({ csvBuffer: noOwnerCsv, etag: "etag-no" }) },
      ),
    ).rejects.toThrow(/ownerColumn.*ausente/);
  });
});
