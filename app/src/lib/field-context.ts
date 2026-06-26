interface FieldWithValue {
  name: string;
  type: string;
  value?: string | null;
}

/**
 * Build an AI-friendly context string from dashboard fields.
 * Returns null if there are no fields with values.
 */
export function buildFieldContext(fields: FieldWithValue[]): string | null {
  const lines = fields
    .filter((f) => f.value != null && f.value !== "")
    .map((f) => `- ${f.name} (${f.type}): ${f.value}`);

  if (lines.length === 0) return null;

  return `Dashboard Fields:\n${lines.join("\n")}`;
}
