import { describe, it, expect } from "vitest";
import { getContentType } from "@/lib/storage";
process.env.ALLOWED_AUTH_DOMAIN = "example.com";
process.env.STORAGE_BUCKET_NAME = "test-bucket";

describe("getContentType", () => {
  it("returns text/html for .html files", () => {
    expect(getContentType("index.html")).toBe("text/html");
    expect(getContentType("reports/detail.html")).toBe("text/html");
  });

  it("returns correct types for common web assets", () => {
    expect(getContentType("style.css")).toBe("text/css");
    expect(getContentType("app.js")).toBe("application/javascript");
    expect(getContentType("data.json")).toBe("application/json");
    expect(getContentType("logo.svg")).toBe("image/svg+xml");
    expect(getContentType("photo.png")).toBe("image/png");
    expect(getContentType("photo.jpg")).toBe("image/jpeg");
    expect(getContentType("photo.webp")).toBe("image/webp");
  });

  it("returns correct types for font files", () => {
    expect(getContentType("font.woff2")).toBe("font/woff2");
    expect(getContentType("font.woff")).toBe("font/woff");
    expect(getContentType("font.ttf")).toBe("font/ttf");
  });

  it("returns application/octet-stream for unknown extensions", () => {
    expect(getContentType("data.bin")).toBe("application/octet-stream");
    expect(getContentType("file.xyz")).toBe("application/octet-stream");
  });

  it("handles nested paths correctly", () => {
    expect(getContentType("assets/css/main.css")).toBe("text/css");
    expect(getContentType("deep/path/to/file.js")).toBe("application/javascript");
  });
});
