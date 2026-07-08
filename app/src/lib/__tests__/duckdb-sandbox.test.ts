import { describe, expect, it } from "vitest";
import {
  createDuckDbSandbox,
  DuckDbSandboxError,
} from "@/lib/data-sources/duckdb-sandbox";

describe("createDuckDbSandbox", () => {
  it("executa query válida e retorna columns e rows", async () => {
    const sandbox = createDuckDbSandbox();

    const result = await sandbox.run(
      `
        WITH twd_test_filtered AS (
          SELECT * FROM (VALUES
            (1, 'ana@example.com', 10),
            (2, 'bob@example.com', 20)
          ) AS t(id, owner_email, amount)
        )
        SELECT owner_email, amount
        FROM twd_test_filtered
        WHERE id = 2
      `,
      "twd_test_filtered",
    );

    expect(result).toEqual({
      columns: ["owner_email", "amount"],
      rows: [["bob@example.com", 20]],
    });
  });

  it("rejeita query bloqueada pelo guard com reason", async () => {
    const sandbox = createDuckDbSandbox();

    await expect(sandbox.run("SELECT * FROM outra_tabela", "twd_test_filtered"))
      .rejects.toMatchObject({
        name: "DuckDbSandboxError",
        reason: "tabela não autorizada: outra_tabela",
      });
  });

  it("aborta query que excede timeout", async () => {
    const sandbox = createDuckDbSandbox({ queryTimeoutMs: 1 });

    await expect(
      sandbox.run(
        `
          WITH twd_timeout_filtered AS (
            SELECT * FROM (VALUES (1), (2), (3), (4), (5), (6), (7), (8), (9), (10)) AS t(n)
          )
          SELECT sum(a.n * b.n * c.n * d.n * e.n * f.n * g.n * h.n)
          FROM twd_timeout_filtered a
          CROSS JOIN twd_timeout_filtered b
          CROSS JOIN twd_timeout_filtered c
          CROSS JOIN twd_timeout_filtered d
          CROSS JOIN twd_timeout_filtered e
          CROSS JOIN twd_timeout_filtered f
          CROSS JOIN twd_timeout_filtered g
          CROSS JOIN twd_timeout_filtered h
        `,
        "twd_timeout_filtered",
      ),
    ).rejects.toMatchObject({
      name: "DuckDbSandboxError",
      reason: "timeout",
    });
  });

  it("exporta erro tipado para a camada HTTP traduzir depois", async () => {
    const sandbox = createDuckDbSandbox();

    await expect(
      sandbox.run("SELECT * FROM outra_tabela", "twd_test_filtered"),
    ).rejects.toBeInstanceOf(DuckDbSandboxError);
  });
});
