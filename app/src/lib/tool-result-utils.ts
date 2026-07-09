// Max chars for a single tool result before summarization (~12K tokens)
const MAX_RESULT_CHARS = 50000;

/**
 * Build a summary object from rows, progressively reducing sample size
 * until the output fits within MAX_RESULT_CHARS.
 */
function buildFittingSummary(
  rows: unknown[],
  columns: string[],
  originalLength: number,
  label: string,
): string {
  // Try progressively smaller sample sizes: 20, 10, 5, 2, 1, 0
  for (const sampleSize of [20, 10, 5, 2, 1, 0]) {
    const sample = rows.slice(0, sampleSize);
    const summary = JSON.stringify({
      _summary: true,
      _message: `Result too large for context (${originalLength} chars, ${rows.length} ${label}). ${
        sampleSize > 0
          ? `Showing first ${sample.length} rows as sample.`
          : "No sample rows included (individual rows too large)."
      } Use LIMIT, WHERE filters, or GROUP BY aggregation to reduce the result size.`,
      totalRows: rows.length,
      columns,
      ...(sampleSize > 0 ? { sampleRows: sample } : {}),
    });
    if (summary.length <= MAX_RESULT_CHARS) return summary;
  }

  // Even 0 rows didn't fit (extremely wide schema) — return minimal error
  return JSON.stringify({
    _summary: true,
    _error: `Result too large (${originalLength} chars, ${rows.length} rows, ${columns.length} columns). Use SELECT with specific columns + LIMIT to reduce size.`,
    totalRows: rows.length,
    columnCount: columns.length,
    columns: columns.slice(0, 20),
  });
}

/**
 * Summarize oversized tool results instead of sending truncated raw data.
 * Parses JSON to produce a structured summary with row counts, column names,
 * and a progressively-sized sample guaranteed to fit within MAX_RESULT_CHARS.
 * Falls back to an error message for non-parseable data.
 * Never sends partial/truncated data to Claude.
 */
export function summarizeIfNeeded(raw: string): string {
  if (raw.length <= MAX_RESULT_CHARS) return raw;

  const originalLength = raw.length;

  try {
    const parsed = JSON.parse(raw);

    // Handle array of rows (most common BQ result shape)
    if (Array.isArray(parsed) && parsed.length > 0) {
      const columns = Object.keys(parsed[0]);
      return buildFittingSummary(parsed, columns, originalLength, "rows");
    }

    // Handle object with rows/data array (e.g. { rows: [...], metadata: ... })
    const rowsKey = ["rows", "data", "results", "items"].find(
      (k) => Array.isArray(parsed[k])
    );
    if (rowsKey && parsed[rowsKey].length > 0) {
      const rows = parsed[rowsKey];
      const columns = Array.isArray(parsed.columns)
        ? parsed.columns.map(String)
        : Object.keys(rows[0]);
      return buildFittingSummary(rows, columns, originalLength, `rows in '${rowsKey}'`);
    }

    // Parseable but not a recognized shape
    return JSON.stringify({
      _summary: true,
      _error: `Result too large for context (${originalLength} chars). Could not extract rows for sampling. Use more specific queries or LIMIT to reduce data size.`,
    });
  } catch {
    // Not valid JSON
    return JSON.stringify({
      _summary: true,
      _error: `Result too large for context (${originalLength} chars) and not parseable for summarization. Use LIMIT or more specific queries to reduce result size.`,
    });
  }
}
