import { describe, it, expect } from "vitest";
import { diffLines, diffStats } from "@/lib/diff-lines";
process.env.ALLOWED_AUTH_DOMAIN = "example.com";
process.env.STORAGE_BUCKET_NAME = "test-bucket";

describe("diffLines", () => {
  it("returns all-equal segments for identical strings", () => {
    const out = diffLines("a\nb\nc", "a\nb\nc");
    expect(out).toEqual([
      { type: "equal", line: "a", oldNum: 1, newNum: 1 },
      { type: "equal", line: "b", oldNum: 2, newNum: 2 },
      { type: "equal", line: "c", oldNum: 3, newNum: 3 },
    ]);
    expect(diffStats(out)).toEqual({ added: 0, removed: 0, unchanged: 3 });
  });

  it("detects added line", () => {
    const out = diffLines("a\nc", "a\nb\nc");
    expect(diffStats(out)).toEqual({ added: 1, removed: 0, unchanged: 2 });
    expect(out.find((s) => s.type === "add")?.line).toBe("b");
  });

  it("detects removed line", () => {
    const out = diffLines("a\nb\nc", "a\nc");
    expect(diffStats(out)).toEqual({ added: 0, removed: 1, unchanged: 2 });
    expect(out.find((s) => s.type === "remove")?.line).toBe("b");
  });

  it("detects replaced line", () => {
    const out = diffLines("a\nb\nc", "a\nB\nc");
    const stats = diffStats(out);
    expect(stats.added).toBe(1);
    expect(stats.removed).toBe(1);
    expect(stats.unchanged).toBe(2);
  });

  it("handles empty inputs", () => {
    expect(diffLines("", "")).toEqual([
      { type: "equal", line: "", oldNum: 1, newNum: 1 },
    ]);
  });
});
