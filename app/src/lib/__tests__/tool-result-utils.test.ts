import { describe, expect, it } from "vitest";
import { summarizeIfNeeded } from "@/lib/tool-result-utils";

describe("summarizeIfNeeded", () => {
  it("preserva columns quando rows e array-of-arrays (query_dataset)", () => {
    const raw = JSON.stringify({
      columns: ["amount", "city"],
      rows: Array.from({ length: 6000 }, (_, i) => [i, `city-${i}`]),
    });

    const summary = JSON.parse(summarizeIfNeeded(raw));

    expect(summary._summary).toBe(true);
    expect(summary.columns).toEqual(["amount", "city"]);
    expect(summary.sampleRows[0]).toEqual([0, "city-0"]);
  });
});
