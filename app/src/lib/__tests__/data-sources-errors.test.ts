import { describe, expect, it } from "vitest";
import { DuckDbSandboxError } from "@/lib/data-sources/duckdb-sandbox";
import {
  publicErrorMessage,
  publicErrorStatus,
} from "@/lib/data-sources/errors";

describe("data source public error mapping", () => {
  it.each([
    "tabela não autorizada: auth_keys",
    "catálogo proibido",
    "UNION proibido",
    "INTERSECT proibido",
    "EXCEPT proibido",
    "multi-statement proibido",
    "SQL inválido: Parser Error",
    "Binder Error: referenced column not found",
  ])("mapeia bloqueio SQL para 400: %s", (message) => {
    const err = new DuckDbSandboxError(message);
    expect(publicErrorStatus(err)).toBe(400);
    expect(publicErrorMessage(err)).toBe("Invalid query.");
  });

  it.each(["CSV inválido", "CSV sem header", "Linha CSV irregular no índice 0"])(
    "mapeia CSV indisponivel para 503: %s",
    (message) => {
      const err = new DuckDbSandboxError(message);
      expect(publicErrorStatus(err)).toBe(503);
      expect(publicErrorMessage(err)).toBe("Data source temporarily unavailable.");
    },
  );
});
