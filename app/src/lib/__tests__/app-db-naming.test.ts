import { describe, it, expect } from "vitest";
import {
process.env.ALLOWED_AUTH_DOMAIN = "example.com";
process.env.STORAGE_BUCKET_NAME = "test-bucket";
  userSchemaName,
  dashboardTablePrefix,
  physicalTableName,
  sanitizeIdentifier,
  sanitizeColumnName,
  tableMatchesPrefix,
  MAX_LOGICAL_NAME_LENGTH,
} from "@/lib/app-db/naming";

describe("userSchemaName", () => {
  it("generates deterministic schema names", () => {
    const s1 = userSchemaName("user-abc-123");
    const s2 = userSchemaName("user-abc-123");
    expect(s1).toBe(s2);
  });

  it("generates different schemas for different users", () => {
    const s1 = userSchemaName("user-a");
    const s2 = userSchemaName("user-b");
    expect(s1).not.toBe(s2);
  });

  it("starts with usr_ prefix", () => {
    expect(userSchemaName("any-uid")).toMatch(/^usr_[a-f0-9]{8}$/);
  });
});

describe("dashboardTablePrefix", () => {
  it("generates prefix from dashboard ID", () => {
    const p = dashboardTablePrefix("abc123def456xyz");
    expect(p).toBe("d_abc123def456");
  });

  it("handles short IDs", () => {
    const p = dashboardTablePrefix("abc");
    expect(p).toBe("d_abc");
  });

  it("strips non-alphanumeric characters", () => {
    const p = dashboardTablePrefix("abc-123_DEF");
    expect(p).toBe("d_abc123def");
  });
});

describe("physicalTableName", () => {
  it("combines prefix and logical name", () => {
    const name = physicalTableName("d_abc123", "clientes");
    expect(name).toBe("d_abc123__clientes");
  });

  it("throws on invalid logical name", () => {
    expect(() => physicalTableName("d_abc", "")).toThrow();
    expect(() => physicalTableName("d_abc", "123start")).toThrow();
  });
});

describe("sanitizeIdentifier", () => {
  it("lowercases and strips unsafe chars", () => {
    expect(sanitizeIdentifier("MyTable")).toBe("mytable");
    expect(sanitizeIdentifier("my-table")).toBe("my_table");
    expect(sanitizeIdentifier("my table")).toBe("my_table");
    expect(sanitizeIdentifier("café")).toBe("caf");
  });

  it("rejects strings starting with non-letter", () => {
    expect(sanitizeIdentifier("123abc")).toBe("");
    expect(sanitizeIdentifier("_abc")).toBe("");
  });

  it("truncates to max length", () => {
    const long = "a" + "b".repeat(100);
    expect(sanitizeIdentifier(long).length).toBe(MAX_LOGICAL_NAME_LENGTH);
  });

  it("returns empty for empty input", () => {
    expect(sanitizeIdentifier("")).toBe("");
  });
});

describe("sanitizeColumnName", () => {
  it("aliases sanitizeIdentifier", () => {
    expect(sanitizeColumnName("MyColumn")).toBe("mycolumn");
  });
});

describe("tableMatchesPrefix", () => {
  it("matches correct prefix", () => {
    expect(tableMatchesPrefix("d_abc123__clientes", "d_abc123")).toBe(true);
  });

  it("rejects wrong prefix", () => {
    expect(tableMatchesPrefix("d_abc123__clientes", "d_xyz789")).toBe(false);
  });

  it("rejects partial prefix match", () => {
    expect(tableMatchesPrefix("d_abc123__clientes", "d_abc")).toBe(false);
  });
});

describe("isolation: different users get different schemas", () => {
  it("user A and user B have distinct schemas", () => {
    const schemaA = userSchemaName("firebase-uid-user-A");
    const schemaB = userSchemaName("firebase-uid-user-B");
    expect(schemaA).not.toBe(schemaB);
  });
});

describe("isolation: different dashboards get different prefixes", () => {
  it("dashboard A1 and A2 have distinct prefixes", () => {
    // Firestore IDs are 20-char random, so first 12 chars will differ in practice
    const prefA1 = dashboardTablePrefix("aAbBcCdDeEfF11111111");
    const prefA2 = dashboardTablePrefix("xXyYzZwW00009999999");
    expect(prefA1).not.toBe(prefA2);
  });

  it("table from dashboard A1 does NOT match dashboard A2 prefix", () => {
    const prefA1 = dashboardTablePrefix("aAbBcCdDeEfF11111111");
    const prefA2 = dashboardTablePrefix("xXyYzZwW00009999999");
    const tableA1 = physicalTableName(prefA1, "clientes");
    expect(tableMatchesPrefix(tableA1, prefA2)).toBe(false);
  });
});
