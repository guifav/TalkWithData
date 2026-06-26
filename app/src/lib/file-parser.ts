/**
 * File Parser — server-side extraction of structured text from uploaded files.
 *
 * Uses ExcelJS for .xlsx (maintained, no known advisories).
 * Runs on the server only (Node.js streams required by ExcelJS).
 *
 * Issue #115
 */

import ExcelJS from "exceljs";

/** Maximum characters of parsed content to inject into AI context */
export const MAX_PARSED_CHARS = 50_000;

export interface ParsedFile {
  name: string;
  type: "xlsx" | "md";
  summary: string;
  content: string;
  truncated: boolean;
  originalChars: number;
}

/**
 * Parse a file buffer server-side and extract structured text content.
 */
export async function parseFileBuffer(
  name: string,
  buffer: Buffer
): Promise<ParsedFile> {
  if (name.endsWith(".xlsx")) {
    return parseXlsx(name, buffer);
  }

  if (name.endsWith(".md") || name.endsWith(".markdown")) {
    return parseMd(name, buffer);
  }

  throw new Error(`Unsupported file type: ${name}. Only .xlsx and .md are accepted.`);
}

async function parseXlsx(name: string, buffer: Buffer): Promise<ParsedFile> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const parts: string[] = [];
  let totalRows = 0;

  for (const sheet of workbook.worksheets) {
    const rows = sheet.getSheetValues() as unknown[][];
    // ExcelJS uses 1-based indexing, index 0 is empty
    const dataRows = rows.filter((r) => r && r.length > 0);
    if (dataRows.length === 0) continue;

    const headers = (dataRows[0] || []).map((h, i) => String(h ?? `col_${i}`));
    const bodyRows = dataRows.slice(1);
    totalRows += bodyRows.length;

    parts.push(`## Sheet: ${sheet.name}`);
    parts.push(`Columns: ${headers.filter(Boolean).join(" | ")}`);
    parts.push(`Rows: ${bodyRows.length}`);
    parts.push("");

    // Include up to 200 rows per sheet
    const maxRows = Math.min(bodyRows.length, 200);
    const validHeaders = headers.filter(Boolean);
    parts.push(`| ${validHeaders.join(" | ")} |`);
    parts.push(`| ${validHeaders.map(() => "---").join(" | ")} |`);

    for (let i = 0; i < maxRows; i++) {
      const row = bodyRows[i] || [];
      const cells = validHeaders.map((_, j) => {
        const val = (row as unknown[])[j + 1]; // ExcelJS 1-based
        return String(val ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ").slice(0, 200);
      });
      parts.push(`| ${cells.join(" | ")} |`);
    }

    if (bodyRows.length > maxRows) {
      parts.push(`... (${bodyRows.length - maxRows} more rows not shown)`);
    }
    parts.push("");
  }

  const summary = `Excel file with ${workbook.worksheets.length} sheet(s), ${totalRows} total rows`;
  const content = parts.join("\n");
  const truncated = content.length > MAX_PARSED_CHARS;

  return {
    name,
    type: "xlsx",
    summary,
    content: truncated ? content.slice(0, MAX_PARSED_CHARS) + "\n\n[Content truncated]" : content,
    truncated,
    originalChars: content.length,
  };
}

function parseMd(name: string, buffer: Buffer): ParsedFile {
  const text = buffer.toString("utf-8");
  const firstHeading = text.match(/^#\s+(.+)/m)?.[1] || text.slice(0, 100).trim();
  const summary = `Markdown document: "${firstHeading}"`;
  const truncated = text.length > MAX_PARSED_CHARS;

  return {
    name,
    type: "md",
    summary,
    content: truncated ? text.slice(0, MAX_PARSED_CHARS) + "\n\n[Content truncated]" : text,
    truncated,
    originalChars: text.length,
  };
}
