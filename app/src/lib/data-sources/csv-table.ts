import { parse } from "csv-parse/sync";

export type InferredColumnType =
  | "text"
  | "integer"
  | "decimal"
  | "boolean"
  | "date"
  | "timestamp";

export interface CsvColumn {
  rawName: string;
  safeName: string;
  type: InferredColumnType;
  nullable: boolean;
}

export interface ParsedCsvTable {
  columns: CsvColumn[];
  rows: string[][];
  rowCount: number;
}

export class CsvParseError extends Error {
  rowIndex: number;
  expectedColumns: number;
  actualColumns: number;

  constructor(
    rowIndex: number,
    expectedColumns: number,
    actualColumns: number,
    message = "CSV inválido",
  ) {
    super(message);
    this.name = "CsvParseError";
    this.rowIndex = rowIndex;
    this.expectedColumns = expectedColumns;
    this.actualColumns = actualColumns;
    Object.setPrototypeOf(this, CsvParseError.prototype);
  }
}

export function parseCsvHeader(input: Buffer | string): string[] {
  const text = Buffer.isBuffer(input) ? input.toString("utf8") : input;
  let records: string[][];
  try {
    records = parse(text, {
      bom: true,
      cast: false,
      columns: false,
      relax_column_count: true,
      skip_empty_lines: false,
      to_line: 1,
      trim: false,
    }) as string[][];
  } catch {
    throw new CsvParseError(-1, 0, 0, "CSV inválido");
  }

  const header = records[0];
  if (!header || isEmptyHeader(header)) {
    throw new CsvParseError(-1, 0, 0, "CSV sem header");
  }
  return header;
}

export function parseCsvRows(input: Buffer | string): {
  header: string[];
  rows: string[][];
} {
  const text = Buffer.isBuffer(input) ? input.toString("utf8") : input;
  const records = parseRecords(text);
  const header = records[0];

  if (!header || isEmptyHeader(header)) {
    throw new CsvParseError(-1, 0, 0, "CSV sem header");
  }

  const rows = records.slice(1);

  rows.forEach((row, rowIndex) => {
    if (row.length !== header.length) {
      // rowIndex é 0-based contando apenas linhas de dados, depois do header.
      throw new CsvParseError(
        rowIndex,
        header.length,
        row.length,
        `Linha CSV irregular no índice ${rowIndex}`,
      );
    }
  });

  return { header, rows };
}

export function inferColumnType(values: string[]): InferredColumnType {
  const nonEmptyValues = values.map((value) => value.trim()).filter(Boolean);

  if (nonEmptyValues.length === 0) {
    return "text";
  }

  if (nonEmptyValues.every(isInt4Integer)) {
    return "integer";
  }

  if (nonEmptyValues.every(isDecimalValue)) {
    return "decimal";
  }

  if (nonEmptyValues.every(isBooleanValue)) {
    return "boolean";
  }

  if (nonEmptyValues.every(isDateValue)) {
    return "date";
  }

  if (nonEmptyValues.every(isTimestampValue)) {
    return "timestamp";
  }

  return "text";
}

export function parseCsvTable(
  input: Buffer | string,
  opts: { sampleSize?: number } = {},
): ParsedCsvTable {
  const { header, rows } = parseCsvRows(input);
  const sampleSize = normalizeSampleSize(opts.sampleSize);
  const sampleRows = rows.slice(0, sampleSize);
  const usedNames = new Set<string>();

  const columns = header.map((rawName, columnIndex): CsvColumn => {
    const sampleValues = sampleRows.map((row) => row[columnIndex] ?? "");
    const allValues = rows.map((row) => row[columnIndex] ?? "");

    return {
      rawName,
      safeName: createSafeName(rawName, usedNames),
      type: inferColumnType(sampleValues),
      nullable: allValues.some(isBlankValue),
    };
  });

  return {
    columns,
    rows,
    rowCount: rows.length,
  };
}

function parseRecords(text: string): string[][] {
  try {
    return parse(text, {
      bom: true,
      cast: false,
      columns: false,
      relax_column_count: true,
      skip_empty_lines: false,
      trim: false,
    }) as string[][];
  } catch {
    throw new CsvParseError(-1, 0, 0, "CSV inválido");
  }
}

function isEmptyHeader(header: string[]): boolean {
  return header.length === 0 || header.every(isBlankValue);
}

function normalizeSampleSize(sampleSize: number | undefined): number {
  if (sampleSize === undefined) {
    return 1000;
  }

  if (!Number.isFinite(sampleSize) || sampleSize < 0) {
    return 0;
  }

  return Math.floor(sampleSize);
}

function createSafeName(rawName: string, usedNames: Set<string>): string {
  let baseName = rawName.toLowerCase().replace(/[^a-z0-9_]/g, "_");

  if (baseName.length === 0) {
    baseName = "column";
  }

  if (/^\d/.test(baseName)) {
    baseName = `_${baseName}`;
  }

  let safeName = baseName;
  let suffix = 2;

  while (usedNames.has(safeName)) {
    safeName = `${baseName}_${suffix}`;
    suffix += 1;
  }

  usedNames.add(safeName);
  return safeName;
}

function isBlankValue(value: string): boolean {
  return value.trim() === "";
}

function isInt4Integer(value: string): boolean {
  if (!/^[+-]?\d+$/.test(value)) {
    return false;
  }

  const big = BigInt(value);

  return big >= BigInt("-2147483648") && big <= BigInt("2147483647");
}

function isDecimalValue(value: string): boolean {
  if (/^[+-]?\d+$/.test(value)) {
    return isInt4Integer(value);
  }

  return /^[+-]?(?:\d+\.\d+|\d+\.|\.\d+)(?:[eE][+-]?\d+)?$/.test(value);
}

function isBooleanValue(value: string): boolean {
  return ["true", "false", "1", "0"].includes(value.toLowerCase());
}

function isDateValue(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  return hasValidDateParts(match[1], match[2], match[3]);
}

function isTimestampValue(value: string): boolean {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?$/.exec(
      value,
    );

  if (!match) {
    return false;
  }

  const [, year, month, day, hour, minute, second = "0"] = match;

  if (!hasValidDateParts(year, month, day)) {
    return false;
  }

  const hourNumber = Number(hour);
  const minuteNumber = Number(minute);
  const secondNumber = Number(second);

  if (
    hourNumber > 23 ||
    minuteNumber > 59 ||
    secondNumber > 59 ||
    Number.isNaN(Date.parse(value))
  ) {
    return false;
  }

  // Datas e timestamps são best-effort: regex filtra formatos ISO comuns e
  // Date.parse confirma que o runtime aceita o valor sem erro.
  return true;
}

function hasValidDateParts(year: string, month: string, day: string): boolean {
  const yearNumber = Number(year);
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  const parsed = Date.parse(`${year}-${month}-${day}T00:00:00Z`);

  if (Number.isNaN(parsed)) {
    return false;
  }

  const date = new Date(parsed);

  return (
    date.getUTCFullYear() === yearNumber &&
    date.getUTCMonth() === monthNumber - 1 &&
    date.getUTCDate() === dayNumber
  );
}
