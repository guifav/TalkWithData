import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
process.env.ALLOWED_AUTH_DOMAIN = "example.com";
process.env.STORAGE_BUCKET_NAME = "test-bucket";

const homePageSource = readFileSync(
  join(process.cwd(), "src", "app", "page.tsx"),
  "utf8"
);

describe("home favorites layout", () => {
  it("shows favorites as a main dashboard tab without a top favorites strip", () => {
    expect(homePageSource).not.toContain('title="Favoritos"');
    expect(homePageSource).toContain('value="favorites"');
  });
});
