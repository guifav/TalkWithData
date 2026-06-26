export function validateFieldValue(
  value: unknown,
  type: string,
  options: string[],
  required: boolean
): { valid: boolean; error?: string; sanitized: string | null } {
  const str = value == null ? null : String(value).trim();

  if (required && (!str || str.length === 0)) {
    return { valid: false, sanitized: null, error: "This field is required" };
  }

  if (!str || str.length === 0) {
    return { valid: true, sanitized: null };
  }

  switch (type) {
    case "NUMBER": {
      const num = Number(str);
      if (isNaN(num)) return { valid: false, sanitized: null, error: "Must be a number" };
      return { valid: true, sanitized: String(num) };
    }
    case "DATE": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(str))
        return { valid: false, sanitized: null, error: "Must be YYYY-MM-DD" };
      return { valid: true, sanitized: str };
    }
    case "SELECT":
      if (!options.includes(str))
        return {
          valid: false,
          sanitized: null,
          error: `Must be one of: ${options.join(", ")}`,
        };
      return { valid: true, sanitized: str };
    case "MULTI_SELECT": {
      const vals = str
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const invalid = vals.filter((v) => !options.includes(v));
      if (invalid.length)
        return {
          valid: false,
          sanitized: null,
          error: `Invalid options: ${invalid.join(", ")}`,
        };
      return { valid: true, sanitized: vals.join(",") };
    }
    case "BOOLEAN":
      if (!["true", "false"].includes(str.toLowerCase()))
        return { valid: false, sanitized: null, error: "Must be true or false" };
      return { valid: true, sanitized: str.toLowerCase() };
    case "URL":
      try {
        new URL(str);
      } catch {
        return { valid: false, sanitized: null, error: "Must be a valid URL" };
      }
      return { valid: true, sanitized: str };
    default:
      // TEXT
      return { valid: true, sanitized: str };
  }
}
