import { describe, expect, it } from "vitest";
import { validateFieldValue } from "@/lib/field-validation";

describe("validateFieldValue: required vs optional", () => {
  it("rejects an empty string when required", () => {
    const result = validateFieldValue("", "TEXT", [], true);
    expect(result).toEqual({ valid: false, sanitized: null, error: "This field is required" });
  });

  it("rejects null when required", () => {
    const result = validateFieldValue(null, "TEXT", [], true);
    expect(result).toEqual({ valid: false, sanitized: null, error: "This field is required" });
  });

  it("rejects a whitespace-only string when required", () => {
    const result = validateFieldValue("   ", "TEXT", [], true);
    expect(result).toEqual({ valid: false, sanitized: null, error: "This field is required" });
  });

  it("allows an empty string when optional, with null sanitized", () => {
    const result = validateFieldValue("", "TEXT", [], false);
    expect(result).toEqual({ valid: true, sanitized: null });
  });

  it("allows null when optional, with null sanitized", () => {
    const result = validateFieldValue(null, "TEXT", [], false);
    expect(result).toEqual({ valid: true, sanitized: null });
  });

  it("allows a whitespace-only string when optional, with null sanitized", () => {
    const result = validateFieldValue("   ", "TEXT", [], false);
    expect(result).toEqual({ valid: true, sanitized: null });
  });
});

describe("validateFieldValue: NUMBER", () => {
  it("accepts a plain integer string", () => {
    const result = validateFieldValue("42", "NUMBER", [], true);
    expect(result).toEqual({ valid: true, sanitized: "42" });
  });

  it("accepts scientific notation and sanitizes to the numeric form", () => {
    const result = validateFieldValue("1e2", "NUMBER", [], true);
    expect(result).toEqual({ valid: true, sanitized: "100" });
  });

  it("rejects a non-numeric string", () => {
    const result = validateFieldValue("abc", "NUMBER", [], true);
    expect(result).toEqual({ valid: false, sanitized: null, error: "Must be a number" });
  });
});

describe("validateFieldValue: DATE", () => {
  it("accepts a well-formed YYYY-MM-DD date", () => {
    const result = validateFieldValue("2026-07-04", "DATE", [], true);
    expect(result).toEqual({ valid: true, sanitized: "2026-07-04" });
  });

  it("rejects a date with non-padded month/day", () => {
    const result = validateFieldValue("2026-7-4", "DATE", [], true);
    expect(result).toEqual({ valid: false, sanitized: null, error: "Must be YYYY-MM-DD" });
  });

  // The regex only checks shape (4 digits, 2 digits, 2 digits); a round-trip
  // check via Date parsing catches calendar-impossible values like this one.
  it("rejects a shape-valid but semantically impossible date", () => {
    const result = validateFieldValue("2026-13-99", "DATE", [], true);
    expect(result).toEqual({ valid: false, sanitized: null, error: "Must be YYYY-MM-DD" });
  });

  it("accepts a real calendar date", () => {
    const result = validateFieldValue("2026-07-04", "DATE", [], true);
    expect(result).toEqual({ valid: true, sanitized: "2026-07-04" });
  });

  it("rejects Feb 29 on a non-leap year", () => {
    const result = validateFieldValue("2026-02-29", "DATE", [], true);
    expect(result).toEqual({ valid: false, sanitized: null, error: "Must be YYYY-MM-DD" });
  });
});

describe("validateFieldValue: SELECT", () => {
  const options = ["red", "green", "blue"];

  it("accepts a value present in options", () => {
    const result = validateFieldValue("green", "SELECT", options, true);
    expect(result).toEqual({ valid: true, sanitized: "green" });
  });

  it("rejects a value not present in options", () => {
    const result = validateFieldValue("purple", "SELECT", options, true);
    expect(result).toEqual({
      valid: false,
      sanitized: null,
      error: "Must be one of: red, green, blue",
    });
  });
});

describe("validateFieldValue: MULTI_SELECT", () => {
  const options = ["red", "green", "blue"];

  it("sanitizes by trimming and rejoining valid entries", () => {
    const result = validateFieldValue(" red , green ", "MULTI_SELECT", options, true);
    expect(result).toEqual({ valid: true, sanitized: "red,green" });
  });

  it("filters out blank entries from repeated commas", () => {
    const result = validateFieldValue("red,,green,", "MULTI_SELECT", options, true);
    expect(result).toEqual({ valid: true, sanitized: "red,green" });
  });

  it("lists invalid entries when any value is not in options", () => {
    const result = validateFieldValue("red,purple,orange", "MULTI_SELECT", options, true);
    expect(result).toEqual({
      valid: false,
      sanitized: null,
      error: "Invalid options: purple, orange",
    });
  });
});

describe("validateFieldValue: BOOLEAN", () => {
  it("accepts 'true' case-insensitively and sanitizes to lowercase", () => {
    const result = validateFieldValue("TRUE", "BOOLEAN", [], true);
    expect(result).toEqual({ valid: true, sanitized: "true" });
  });

  it("accepts 'false' case-insensitively and sanitizes to lowercase", () => {
    const result = validateFieldValue("False", "BOOLEAN", [], true);
    expect(result).toEqual({ valid: true, sanitized: "false" });
  });

  it("rejects a non-boolean string", () => {
    const result = validateFieldValue("maybe", "BOOLEAN", [], true);
    expect(result).toEqual({ valid: false, sanitized: null, error: "Must be true or false" });
  });
});

describe("validateFieldValue: URL", () => {
  it("accepts a well-formed URL", () => {
    const result = validateFieldValue("https://example.com/path", "URL", [], true);
    expect(result).toEqual({ valid: true, sanitized: "https://example.com/path" });
  });

  it("rejects a string that the URL constructor cannot parse", () => {
    const result = validateFieldValue("not a url", "URL", [], true);
    expect(result).toEqual({ valid: false, sanitized: null, error: "Must be a valid URL" });
  });
});

describe("validateFieldValue: unknown type", () => {
  it("falls through to TEXT passthrough behavior for an unrecognized type", () => {
    const result = validateFieldValue("  some value  ", "SOMETHING_UNKNOWN", [], true);
    expect(result).toEqual({ valid: true, sanitized: "some value" });
  });
});
