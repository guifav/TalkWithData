type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function parseInsertRowsBody(
  body: unknown,
): ValidationResult<Record<string, unknown>[]> {
  if (!isPlainObject(body) || !Array.isArray(body.rows) || body.rows.length === 0) {
    return { ok: false, error: "rows array required" };
  }
  if (body.rows.length > 100) {
    return { ok: false, error: "Max 100 rows per request" };
  }
  if (!body.rows.every(isPlainObject)) {
    return { ok: false, error: "rows must contain objects" };
  }
  return { ok: true, value: body.rows };
}

export function parseRowPatchBody(
  body: unknown,
): ValidationResult<Record<string, unknown>> {
  if (
    !isPlainObject(body) ||
    !isPlainObject(body.data) ||
    Object.keys(body.data).length === 0
  ) {
    return { ok: false, error: "data object required" };
  }
  return { ok: true, value: body.data };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

