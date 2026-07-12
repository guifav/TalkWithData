import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(process.cwd(), "..");
const screenshotFiles = [
  "home-dashboards.png",
  "dashboard-view.png",
  "ai-data-chat.png",
  "data-sources-admin.png",
  "embed-view.png",
];

describe("README product screenshots", () => {
  it("ships valid PNG captures linked from both README files", () => {
    const readmes = ["README.md", "README.pt-BR.md"].map((file) =>
      readFileSync(join(repositoryRoot, file), "utf8"),
    );

    for (const file of screenshotFiles) {
      const relativePath = `docs/screenshots/${file}`;
      const screenshotPath = join(repositoryRoot, relativePath);
      const signature = readFileSync(screenshotPath).subarray(0, 8);

      expect(statSync(screenshotPath).size).toBeGreaterThan(10_000);
      expect([...signature]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      for (const readme of readmes) expect(readme).toContain(relativePath);
    }
  });
});
