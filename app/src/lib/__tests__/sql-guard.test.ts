import { describe, expect, it } from "vitest";
import { guardSql } from "@/lib/data-sources/sql-guard";

const allowedViewName = "twd_source_filtered";

function expectOk(sql: string) {
  const result = guardSql(sql, { allowedViewName });

  expect(result).toEqual({ ok: true, statementCount: 1 });
}

function expectBlocked(sql: string, reason: string) {
  const result = guardSql(sql, { allowedViewName });

  expect(result).toMatchObject({ ok: false });
  if (result.ok) {
    throw new Error("A query deveria ter sido bloqueada");
  }
  expect(result.reason).toContain(reason);
}

describe("guardSql", () => {
  it("aceita CTE que consulta a view autorizada", () => {
    expectOk(`
      WITH base AS (
        SELECT owner_email, amount
        FROM ${allowedViewName}
      )
      SELECT owner_email, sum(amount) AS total
      FROM base
      GROUP BY owner_email
    `);
  });

  it("aceita subquery que consulta a view autorizada", () => {
    expectOk(`
      SELECT *
      FROM ${allowedViewName}
      WHERE id IN (
        SELECT id
        FROM main.${allowedViewName}
        WHERE amount > 10
      )
    `);
  });

  it("aceita identifiers com aspas e schema main opcional", () => {
    const result = guardSql(
      `
        SELECT "Owner Email" AS owner_email
        FROM main."twd source filtered" AS fonte
      `,
      { allowedViewName: "twd source filtered" },
    );

    expect(result).toEqual({ ok: true, statementCount: 1 });
  });

  it("preserva comentários dentro de literals", () => {
    expectOk(`
      SELECT '-- não é comentário /* nem este trecho */' AS note
      FROM ${allowedViewName}
    `);
  });

  it("aceita aliases na view autorizada", () => {
    expectOk(`
      SELECT ds.owner_email
      FROM ${allowedViewName} AS ds
      WHERE ds.amount > 0
    `);
  });

  it("aceita table refs recursivos em subquery quando apontam para a view autorizada", () => {
    expectOk(`
      SELECT outer_ds.owner_email
      FROM ${allowedViewName} outer_ds
      WHERE EXISTS (
        SELECT 1
        FROM ${allowedViewName} inner_ds
        WHERE inner_ds.owner_email = outer_ds.owner_email
      )
    `);
  });

  it.each([
    ["UNION", `SELECT id FROM ${allowedViewName} UNION SELECT id FROM ${allowedViewName}`],
    [
      "INTERSECT",
      `SELECT id FROM ${allowedViewName} INTERSECT SELECT id FROM ${allowedViewName}`,
    ],
    ["EXCEPT", `SELECT id FROM ${allowedViewName} EXCEPT SELECT id FROM ${allowedViewName}`],
  ])("rejeita %s", (operator, sql) => {
    expectBlocked(sql, `${operator} proibido`);
  });

  it.each([
    "read_csv",
    "read_csv_auto",
    "read_parquet",
    "read_json",
    "read_json_auto",
    "read_json_objects",
    "read_json_objects_auto",
    "read_ndjson",
    "read_ndjson_auto",
    "read_ndjson_objects",
    "read_text",
    "read_blob",
    "read_xlsx",
  ])(
    "rejeita reader bloqueado %s",
    (functionName) => {
      expectBlocked(
        `SELECT * FROM ${functionName}('gs://bucket/file')`,
        `função bloqueada: ${functionName}`,
      );
    },
  );

  it.each(["information_schema.tables", "pg_catalog.pg_tables"])(
    "rejeita catálogo %s",
    (tableName) => {
      expectBlocked(`SELECT * FROM ${tableName}`, "catálogo proibido");
    },
  );

  it("rejeita multi-statement útil", () => {
    expectBlocked(
      `SELECT * FROM ${allowedViewName}; SELECT * FROM ${allowedViewName}`,
      "multi-statement proibido",
    );
  });

  it("aceita a view correta", () => {
    expectOk(`SELECT owner_email, amount FROM ${allowedViewName}`);
  });

  it("ignora comentário fora de literal", () => {
    expectOk(`
      SELECT owner_email
      FROM ${allowedViewName}
      -- ; DROP TABLE outra_tabela
    `);
  });

  it("rejeita função bloqueada dentro da projeção", () => {
    expectBlocked(
      `SELECT read_blob(path) FROM ${allowedViewName}`,
      "função bloqueada: read_blob",
    );
  });

  it("rejeita tabela não autorizada", () => {
    expectBlocked("SELECT * FROM outra_tabela", "tabela não autorizada: outra_tabela");
  });

  it("rejeita DDL", () => {
    expectBlocked("CREATE TABLE twd_source_filtered(id integer)", "statement proibido");
  });

  it("rejeita SHOW TABLES", () => {
    expectBlocked("SHOW TABLES", "statement proibido");
  });

  it("rejeita DESCRIBE (parse invalido ou statement bloqueado)", () => {
    const result = guardSql(`DESCRIBE ${allowedViewName}`, { allowedViewName });
    expect(result).toMatchObject({ ok: false });
  });

  it.each([
    "query_table",
    "query",
    "duckdb_tables",
    "duckdb_columns",
    "duckdb_functions",
    "pragma_table_info",
  ])("rejeita function scan de catálogo/raw %s", (functionName) => {
    const result = guardSql(`SELECT * FROM ${functionName}('auth_keys')`, {
      allowedViewName,
    });
    expect(result.ok).toBe(false);
  });

  it("rejeita function scan de catálogo sem argumento (duckdb_tables())", () => {
    const result = guardSql("SELECT * FROM duckdb_tables()", {
      allowedViewName,
    });
    expect(result.ok).toBe(false);
  });

  it("rejeita acesso direto à tabela de escopo auth_keys", () => {
    expectBlocked("SELECT * FROM auth_keys", "tabela não autorizada: auth_keys");
  });
});
