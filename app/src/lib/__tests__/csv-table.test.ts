import { describe, expect, it } from "vitest";
import {
  CsvParseError,
  inferColumnType,
  parseCsvRows,
  parseCsvTable,
} from "@/lib/data-sources/csv-table";

describe("parseCsvRows", () => {
  it("parseia aspas com vírgula, newline, CRLF e trailing newline", () => {
    const csv =
      'Name,Note,Amount\r\n"Ana, Maria","linha 1\nlinha 2",10\r\nBob,"ok",20\r\n';

    expect(parseCsvRows(csv)).toEqual({
      header: ["Name", "Note", "Amount"],
      rows: [
        ["Ana, Maria", "linha 1\nlinha 2", "10"],
        ["Bob", "ok", "20"],
      ],
    });
  });

  it("aceita Buffer e string com o mesmo resultado", () => {
    const csv = "name,age\nAna,37\n";

    expect(parseCsvRows(Buffer.from(csv, "utf8"))).toEqual(parseCsvRows(csv));
  });

  it("rejeita CSV sem header", () => {
    expect(() => parseCsvRows("")).toThrow(CsvParseError);
  });

  it("rejeita linha irregular com rowIndex de dados 0-based", () => {
    try {
      parseCsvRows("name,age\nAna,37\nBob\n");
    } catch (error) {
      expect(error).toBeInstanceOf(CsvParseError);
      expect(error).toMatchObject({
        rowIndex: 1,
        expectedColumns: 2,
        actualColumns: 1,
      });
      return;
    }

    throw new Error("Era esperado CsvParseError");
  });
});

describe("inferColumnType", () => {
  it("infere integer apenas para inteiros int4", () => {
    expect(inferColumnType(["1", "-2", "2147483647"])).toBe("integer");
  });

  it("mantém bigint fora de int4 como text", () => {
    expect(inferColumnType(["2147483648"])).toBe("text");
    expect(inferColumnType(["-2147483649"])).toBe("text");
  });

  it("infere decimal quando todos os valores não vazios são numéricos", () => {
    expect(inferColumnType(["1.5", "-2", "0.25", ""])).toBe("decimal");
  });

  it("infere boolean para true, false, 1 e 0", () => {
    expect(inferColumnType(["true", "FALSE", "1", "0", ""])).toBe("boolean");
  });

  it("infere date com validação real de calendário", () => {
    expect(inferColumnType(["2026-07-08", "1999-12-31"])).toBe("date");
    expect(inferColumnType(["2026-02-30"])).toBe("text");
  });

  it("respeita limites int4 incluindo o mínimo negativo", () => {
    expect(inferColumnType(["-2147483648"])).toBe("integer");
    expect(inferColumnType(["2147483647"])).toBe("integer");
    expect(inferColumnType(["-2147483649"])).toBe("text");
    expect(inferColumnType(["2147483648"])).toBe("text");
  });

  it("infere timestamp para valores com data e horario validos", () => {
    expect(inferColumnType(["2026-07-08T10:30:00Z", "2026-07-08 11:30:00"])).toBe(
      "timestamp",
    );
  });

  it("cai para text quando há mistura incompatível ou só valores vazios", () => {
    expect(inferColumnType(["1", "nao numerico"])).toBe("text");
    expect(inferColumnType(["", ""])).toBe("text");
  });
});

describe("parseCsvTable", () => {
  it("gera colunas com rawName, safeName, tipo e nullability", () => {
    const table = parseCsvTable("Name,Age,Joined\nAna,37,2026-07-08\nBob,,2026-07-09\n");

    expect(table).toEqual({
      columns: [
        { rawName: "Name", safeName: "name", type: "text", nullable: false },
        { rawName: "Age", safeName: "age", type: "integer", nullable: true },
        { rawName: "Joined", safeName: "joined", type: "date", nullable: false },
      ],
      rows: [
        ["Ana", "37", "2026-07-08"],
        ["Bob", "", "2026-07-09"],
      ],
      rowCount: 2,
    });
  });

  it("deduplica colisão de safeName com sufixo numérico", () => {
    const table = parseCsvTable("A B,a-b,1Start\nA,B,C\n");

    expect(table.columns.map((column) => column.safeName)).toEqual([
      "a_b",
      "a_b_2",
      "_1start",
    ]);
  });

  it("limita apenas a inferência pelo sampleSize, mantendo todas as linhas", () => {
    const table = parseCsvTable("value\n1\n2\ntexto\n", { sampleSize: 2 });

    expect(table.columns[0]).toMatchObject({
      rawName: "value",
      safeName: "value",
      type: "integer",
      nullable: false,
    });
    expect(table.rows).toEqual([["1"], ["2"], ["texto"]]);
    expect(table.rowCount).toBe(3);
  });
});
