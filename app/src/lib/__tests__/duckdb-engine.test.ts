import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DuckDbSandboxError } from "@/lib/data-sources/duckdb-sandbox";
import {
  __engineCacheReset,
  __engineCacheStats,
  loadSource,
  type DuckDbSource,
} from "@/lib/data-sources/duckdb-engine";
import { DataSourceKind, type DataSource } from "@/lib/data-sources/types";

const csv = Buffer.from(
  [
    "owner_email,amount",
    "ana@example.com,10",
    "bob@example.com,20",
    "ana@example.com,30",
  ].join("\n"),
);

function source(overrides: Partial<DataSource> = {}): DataSource {
  return {
    id: "src1",
    kind: DataSourceKind.CSV,
    orgId: "org1",
    configVersion: 1,
    ownerColumn: "owner_email",
    ownerColumnIdentity: "email",
    ...overrides,
  };
}

async function countRows(viewName: string, run: DuckDbSource["run"]) {
  const result = await run(`SELECT COUNT(*) AS total FROM ${viewName}`);
  return Number(result.rows[0]?.[0] ?? 0);
}

function rawTableName(sourceId: string): string {
  return `twd_raw_${createHash("sha1").update(sourceId).digest("hex").slice(0, 16)}`;
}

describe("loadSource", () => {
  it("isola viewers antes de agregações, window functions, subqueries e joins", async () => {
    const sharedSource = source({ id: "src-cross-viewer" });
    const ana = await loadSource({
      source: sharedSource,
      csvBuffer: csv,
      viewerScope: { ownerKeys: ["ana@example.com"] },
      etag: "etag-cross-viewer",
      configVersion: 1,
    });

    const bob = await loadSource({
      source: sharedSource,
      csvBuffer: csv,
      viewerScope: { ownerKeys: ["bob@example.com"] },
      etag: "etag-cross-viewer",
      configVersion: 1,
    });

    await expect(countRows(ana.viewName, ana.run)).resolves.toBe(2);
    await expect(countRows(bob.viewName, bob.run)).resolves.toBe(1);

    const anaWindow = await ana.run(`
      SELECT amount, RANK() OVER (ORDER BY amount) AS rank_value
      FROM ${ana.viewName}
      ORDER BY amount
    `);
    expect(
      anaWindow.rows.map(([amount, rankValue]) => [
        amount,
        Number(rankValue),
      ]),
    ).toEqual([
      [10, 1],
      [30, 2],
    ]);

    const anaScalarSubquery = await ana.run(`
      SELECT amount, (SELECT COUNT(*) FROM ${ana.viewName}) AS visible_count
      FROM ${ana.viewName}
      ORDER BY amount
    `);
    expect(
      anaScalarSubquery.rows.map(([amount, visibleCount]) => [
        amount,
        Number(visibleCount),
      ]),
    ).toEqual([
      [10, 2],
      [30, 2],
    ]);

    // Prova de isolamento antes de agregacao: a VIEW ja filtra pelo viewer,
    // entao SUM/COUNT so enxergam as linhas do viewer (a coluna de owner foi
    // removida da view por seguranca e nao pode ser usada no output/JOIN).
    const bobAggregate = await bob.run(`
      SELECT SUM(amount) AS total
      FROM ${bob.viewName}
    `);
    expect(
      bobAggregate.rows.map(([total]) => Number(total)),
    ).toEqual([20]);
  });

  it("normaliza ownerColumn email do CSV antes do filtro", async () => {
    const mixedCaseCsv = Buffer.from(
      ["owner_email,amount", " ANA@Example.com ,10", "bob@example.com,20"].join("\n"),
    );
    const engine = await loadSource({
      source: source({ id: "src-email-normalization" }),
      csvBuffer: mixedCaseCsv,
      viewerScope: { ownerKeys: ["ana@example.com"] },
      etag: "etag-email-normalization",
      configVersion: 1,
    });

    const result = await engine.run(`SELECT amount FROM ${engine.viewName}`);
    expect(result.rows).toEqual([[10]]);
  });

  it("falha fechado quando ownerColumn está ausente", async () => {
    __engineCacheReset();
    const engine = await loadSource({
      source: source({ id: "src-no-owner-column", ownerColumn: "" }),
      csvBuffer: csv,
      viewerScope: { ownerKeys: ["ana@example.com"] },
      etag: "etag-no-owner-column",
      configVersion: 1,
    });

    await expect(countRows(engine.viewName, engine.run)).rejects.toThrow(/ownerColumn valida/);
  });

  it("falha fechado quando header equivalente normaliza para ownerColumn", async () => {
    __engineCacheReset();
    const leakyCsv = Buffer.from(
      ["owner_email,owner_email ,amount", "ana@example.com,ana@example.com,10"].join("\n"),
    );
    const engine = await loadSource({
      source: source({ id: "src-normalized-owner-duplicate" }),
      csvBuffer: leakyCsv,
      viewerScope: { ownerKeys: ["ana@example.com"] },
      etag: "etag-normalized-owner-duplicate",
      configVersion: 1,
    });

    await expect(engine.run(`SELECT * FROM ${engine.viewName}`)).rejects.toThrow(
      /multiplas colunas de escopo/i,
    );
  });

  it("retorna zero linhas quando ownerKeys está vazio", async () => {
    const engine = await loadSource({
      source: source({ id: "src-empty-owner-keys" }),
      csvBuffer: csv,
      viewerScope: { ownerKeys: [] },
      etag: "etag-empty-owner-keys",
      configVersion: 1,
    });

    await expect(countRows(engine.viewName, engine.run)).resolves.toBe(0);
  });

  it("reusa cache para mesma etag e recarrega quando etag muda", async () => {
    const cachedSource = source({ id: "src-cache" });
    const firstCsv = Buffer.from("owner_email,amount\nana@example.com,10\n");
    const secondCsv = Buffer.from("owner_email,amount\nana@example.com,99\n");

    const first = await loadSource({
      source: cachedSource,
      csvBuffer: firstCsv,
      viewerScope: { ownerKeys: ["ana@example.com"] },
      etag: "etag-1",
      configVersion: 1,
    });
    const cached = await loadSource({
      source: cachedSource,
      csvBuffer: secondCsv,
      viewerScope: { ownerKeys: ["ana@example.com"] },
      etag: "etag-1",
      configVersion: 1,
    });
    const reloaded = await loadSource({
      source: cachedSource,
      csvBuffer: secondCsv,
      viewerScope: { ownerKeys: ["ana@example.com"] },
      etag: "etag-2",
      configVersion: 1,
    });

    await expect(first.run(`SELECT amount FROM ${first.viewName}`)).resolves.toMatchObject({
      rows: [[10]],
    });
    await expect(cached.run(`SELECT amount FROM ${cached.viewName}`)).resolves.toMatchObject({
      rows: [[10]],
    });
    await expect(reloaded.run(`SELECT amount FROM ${reloaded.viewName}`)).resolves.toMatchObject({
      rows: [[99]],
    });
  });

  it("recarrega quando configVersion muda", async () => {
    const cachedSource = source({ id: "src-cache-config" });
    const firstCsv = Buffer.from("owner_email,amount\nana@example.com,10\n");
    const secondCsv = Buffer.from("owner_email,amount\nana@example.com,42\n");

    const first = await loadSource({
      source: cachedSource,
      csvBuffer: firstCsv,
      viewerScope: { ownerKeys: ["ana@example.com"] },
      etag: "same-etag",
      configVersion: 1,
    });
    const reloaded = await loadSource({
      source: { ...cachedSource, configVersion: 2 },
      csvBuffer: secondCsv,
      viewerScope: { ownerKeys: ["ana@example.com"] },
      etag: "same-etag",
      configVersion: 2,
    });

    await expect(first.run(`SELECT amount FROM ${first.viewName}`)).resolves.toMatchObject({
      rows: [[10]],
    });
    await expect(reloaded.run(`SELECT amount FROM ${reloaded.viewName}`)).resolves.toMatchObject({
      rows: [[42]],
    });
  });

  it("bloqueia acesso direto à tabela bruta pelo run do modelo", async () => {
    const engine = await loadSource({
      source: source({ id: "src-raw-blocked" }),
      csvBuffer: csv,
      viewerScope: { ownerKeys: ["ana@example.com"] },
      etag: "etag-raw-blocked",
      configVersion: 1,
    });

    const rawSafe = rawTableName("src-raw-blocked");

    await expect(engine.run(`SELECT * FROM ${rawSafe}`))
      .rejects.toMatchObject({
        name: "DuckDbSandboxError",
        reason: `tabela não autorizada: ${rawSafe}`,
      });
    await expect(engine.run(`SELECT * FROM ${engine.viewName}`)).resolves.toMatchObject({
      rows: [
        [10],
        [30],
      ],
    });
    await expect(
      engine.run(`CREATE TABLE ${engine.viewName} (amount INTEGER)`),
    ).rejects.toBeInstanceOf(DuckDbSandboxError);
  });

  it("sinaliza truncamento quando o resultado excede maxRows", async () => {
    const prev = process.env.TWD_MAX_ROWS;
    try {
      process.env.TWD_MAX_ROWS = "1";
      const engine = await loadSource({
        source: source({ id: "src-trunc" }),
        csvBuffer: csv,
        viewerScope: { ownerKeys: ["ana@example.com"] },
        etag: "etag-trunc",
        configVersion: 1,
      });
      const result = await engine.run(
        `SELECT amount FROM ${engine.viewName} ORDER BY amount`,
      );
      expect(result.truncated).toBe(true);
      expect(result.rows.length).toBe(1);
    } finally {
      if (prev === undefined) delete process.env.TWD_MAX_ROWS;
      else process.env.TWD_MAX_ROWS = prev;
      __engineCacheReset();
    }
  });

  it("aplica LRU por bytes e fecha a instancia evictida", async () => {
    const prev = process.env.TWD_ENGINE_LRU_BYTES;
    try {
      process.env.TWD_ENGINE_LRU_BYTES = "1";
      __engineCacheReset();
      await loadSource({
        source: source({ id: "src-lru-a" }),
        csvBuffer: csv,
        viewerScope: { ownerKeys: ["ana@example.com"] },
        etag: "etag-lru",
        configVersion: 1,
      });
      await loadSource({
        source: source({ id: "src-lru-b" }),
        csvBuffer: csv,
        viewerScope: { ownerKeys: ["ana@example.com"] },
        etag: "etag-lru",
        configVersion: 1,
      });
      expect(__engineCacheStats().size).toBeLessThan(2);
    } finally {
      if (prev === undefined) delete process.env.TWD_ENGINE_LRU_BYTES;
      else process.env.TWD_ENGINE_LRU_BYTES = prev;
      __engineCacheReset();
    }
  });

  it("suporta viewers concorrentes no mesmo source sem Catalog write-write conflict", async () => {
    const sharedSource = source({ id: "src-concurrent" });
    const ana = await loadSource({
      source: sharedSource,
      csvBuffer: csv,
      viewerScope: { ownerKeys: ["ana@example.com"] },
      etag: "etag-concurrent",
      configVersion: 1,
    });
    const bob = await loadSource({
      source: sharedSource,
      csvBuffer: csv,
      viewerScope: { ownerKeys: ["bob@example.com"] },
      etag: "etag-concurrent",
      configVersion: 1,
    });

    const [anaCount, bobCount] = await Promise.all([
      countRows(ana.viewName, ana.run),
      countRows(bob.viewName, bob.run),
    ]);
    expect(anaCount).toBe(2);
    expect(bobCount).toBe(1);
  });

  it("aceita coluna com nome reservado do DuckDB (ex.: select)", async () => {
    const reservedCsv = Buffer.from("select,amount,owner\na,10,x\nb,30,y\n");
    const engine = await loadSource({
      source: source({ id: "src-reserved", ownerColumn: "owner" }),
      csvBuffer: reservedCsv,
      viewerScope: { ownerKeys: ["x"] },
      etag: "etag-reserved",
      configVersion: 1,
    });
    const result = await engine.run(
      `SELECT "select", amount FROM ${engine.viewName} ORDER BY "select"`,
    );
    expect(result.rows).toEqual([
      ["a", 10],
    ]);
  });

  it("mapeia boolean 1/0 e true/false corretamente", async () => {
    const boolCsv = Buffer.from("owner,flag\nana,1\nbob,0\nx,true\ny,false\n");
    const engine = await loadSource({
      source: source({ id: "src-bool", ownerColumn: "owner" }),
      csvBuffer: boolCsv,
      viewerScope: { ownerKeys: ["ana", "x"] },
      etag: "etag-bool",
      configVersion: 1,
    });
    const result = await engine.run(
      `SELECT flag FROM ${engine.viewName} ORDER BY flag`,
    );
    expect(result.rows).toEqual([
      [true],
      [true],
    ]);
  });

  it("rebaixa coluna para texto quando um valor fora da amostra nao é numerico", async () => {
    const outlierCsv = Buffer.from("owner,amount\nana,10\nbob,abc\nx,30\n");
    const engine = await loadSource({
      source: source({ id: "src-outlier", ownerColumn: "owner" }),
      csvBuffer: outlierCsv,
      viewerScope: { ownerKeys: ["ana", "bob", "x"] },
      etag: "etag-outlier",
      configVersion: 1,
    });
    const result = await engine.run(
      `SELECT amount FROM ${engine.viewName} ORDER BY amount`,
    );
    expect(result.rows).toEqual([
      ["10"],
      ["30"],
      ["abc"],
    ]);
  });

  it("preserva owner keys como texto (owner=001 diferente de owner=1)", async () => {
    const ownerCsv = Buffer.from("owner,amount\n001,10\n1,20\n");
    const engine = await loadSource({
      source: source({ id: "src-owner-text", ownerColumn: "owner" }),
      csvBuffer: ownerCsv,
      viewerScope: { ownerKeys: ["001"] },
      etag: "etag-owner-text",
      configVersion: 1,
    });
    const result = await engine.run(
      `SELECT amount FROM ${engine.viewName} ORDER BY amount`,
    );
    expect(result.rows).toEqual([[10]]);
  });

  it("nao trunca/wrap inteiros fora de int4 (rebaixa para decimal)", async () => {
    const bigCsv = Buffer.from("owner,big\nana,1\nbob,2147483648\n");
    const engine = await loadSource({
      source: source({ id: "src-bigint", ownerColumn: "owner" }),
      csvBuffer: bigCsv,
      viewerScope: { ownerKeys: ["ana", "bob"] },
      etag: "etag-bigint",
      configVersion: 1,
    });
    const result = await engine.run(
      `SELECT big FROM ${engine.viewName} ORDER BY big`,
    );
    expect(result.rows).toEqual([
      ["1"],
      ["2147483648"],
    ]);
  });

  it("nao deruba o carregamento quando date/timestamp tem outlier fora da amostra", async () => {
    const dateCsv = Buffer.from("owner,dt\nana,2024-01-01\nbob,not-a-date\n");
    const engine = await loadSource({
      source: source({ id: "src-date", ownerColumn: "owner" }),
      csvBuffer: dateCsv,
      viewerScope: { ownerKeys: ["ana", "bob"] },
      etag: "etag-date",
      configVersion: 1,
    });
    const result = await engine.run(
      `SELECT dt FROM ${engine.viewName} ORDER BY dt`,
    );
    expect(result.rows).toEqual([
      ["2024-01-01"],
      ["not-a-date"],
    ]);
  });
});
