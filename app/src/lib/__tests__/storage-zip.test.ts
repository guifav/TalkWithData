import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import {
  deleteDashboardFiles,
  deleteHtmlFile,
  getContentType,
  getDashboardAsset,
  getHtmlFile,
  uploadHtmlFile,
  uploadZipDashboard,
} from "@/lib/storage";
process.env.ALLOWED_AUTH_DOMAIN = "example.com";

let storageRoot: string;
const previousProvider = process.env.STORAGE_PROVIDER;
const previousRoot = process.env.LOCAL_STORAGE_ROOT;
const previousBucket = process.env.STORAGE_BUCKET_NAME;

beforeEach(async () => {
  storageRoot = await mkdtemp(path.join(tmpdir(), "twd-storage-"));
  process.env.STORAGE_PROVIDER = "local";
  process.env.LOCAL_STORAGE_ROOT = storageRoot;
  delete process.env.STORAGE_BUCKET_NAME;
});

afterEach(async () => {
  await rm(storageRoot, { recursive: true, force: true });
  restoreEnv("STORAGE_PROVIDER", previousProvider);
  restoreEnv("LOCAL_STORAGE_ROOT", previousRoot);
  restoreEnv("STORAGE_BUCKET_NAME", previousBucket);
});

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

describe("local dashboard storage", () => {
  it("uploads, reads, and deletes a single HTML dashboard without a bucket", async () => {
    const html = Buffer.from("<html><body>local</body></html>");

    const storagePath = await uploadHtmlFile("user-1", "dash-1", "index.html", html);

    await expect(getHtmlFile(storagePath)).resolves.toEqual(html);
    await expect(readFile(path.join(storageRoot, storagePath))).resolves.toEqual(html);

    await deleteHtmlFile(storagePath);
    await expect(readFile(path.join(storageRoot, storagePath))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("uploads and serves a multi-page dashboard asset without a bucket", async () => {
    const zip = new AdmZip();
    zip.addFile("site/index.html", Buffer.from("<html><body>multi</body></html>"));
    zip.addFile("site/assets/main.css", Buffer.from("body { color: navy; }"));

    const result = await uploadZipDashboard("user-1", "dash-2", zip.toBuffer());

    expect(result.storagePath).toBe("dashboards/user-1/dash-2/index.html");
    await expect(getHtmlFile(result.storagePath)).resolves.toEqual(
      Buffer.from("<html><body>multi</body></html>")
    );
    await expect(getDashboardAsset(result.storagePrefix, "assets/main.css")).resolves.toEqual({
      buffer: Buffer.from("body { color: navy; }"),
      contentType: "text/css",
    });

    await deleteDashboardFiles(result.storagePrefix);
    await expect(getDashboardAsset(result.storagePrefix, "assets/main.css")).resolves.toBeNull();
  });
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
