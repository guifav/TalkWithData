import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { getStorageProvider, LocalStorage } from "@/lib/storage-provider";

let storageRoot: string;
const previousProvider = process.env.STORAGE_PROVIDER;
const previousRoot = process.env.LOCAL_STORAGE_ROOT;

beforeEach(async () => {
  storageRoot = await mkdtemp(path.join(tmpdir(), "twd-provider-"));
  process.env.STORAGE_PROVIDER = "local";
  process.env.LOCAL_STORAGE_ROOT = storageRoot;
});

afterEach(async () => {
  await rm(storageRoot, { recursive: true, force: true });
  restoreEnv("STORAGE_PROVIDER", previousProvider);
  restoreEnv("LOCAL_STORAGE_ROOT", previousRoot);
});

describe("LocalStorage", () => {
  it("is selected without constructing a GCS client", () => {
    expect(getStorageProvider()).toBeInstanceOf(LocalStorage);
  });

  it("copies files and creates the destination directory", async () => {
    const provider = getStorageProvider();
    await provider.upload("dashboards/user/source.html", Buffer.from("source"));

    await provider.copy("dashboards/user/source.html", "versions/dash/1/source.html");

    await expect(provider.download("versions/dash/1/source.html")).resolves.toEqual(
      Buffer.from("source")
    );
  });

  it("preserves the current file when an atomic upload cannot be committed", async () => {
    const provider = getStorageProvider();
    const storagePath = "dashboards/user/index.html";
    await provider.upload(storagePath, Buffer.from("current"));
    const rename = vi.spyOn(fs, "rename").mockRejectedValueOnce(new Error("rename failed"));

    await expect(provider.upload(storagePath, Buffer.from("replacement"))).rejects.toThrow(
      "rename failed"
    );

    await expect(provider.download(storagePath)).resolves.toEqual(Buffer.from("current"));
    await expect(readdir(path.join(storageRoot, "dashboards/user"))).resolves.toEqual([
      "index.html",
    ]);
    rename.mockRestore();
  });

  it("preserves the destination when an atomic copy cannot be committed", async () => {
    const provider = getStorageProvider();
    await provider.upload("versions/dash/1/source.html", Buffer.from("source"));
    await provider.upload("dashboards/user/index.html", Buffer.from("current"));
    const rename = vi.spyOn(fs, "rename").mockRejectedValueOnce(new Error("rename failed"));

    await expect(
      provider.copy("versions/dash/1/source.html", "dashboards/user/index.html")
    ).rejects.toThrow("rename failed");

    await expect(provider.download("dashboards/user/index.html")).resolves.toEqual(
      Buffer.from("current")
    );
    await expect(readdir(path.join(storageRoot, "dashboards/user"))).resolves.toEqual([
      "index.html",
    ]);
    rename.mockRestore();
  });

  it("rejects traversal and absolute paths", async () => {
    const provider = getStorageProvider();

    await expect(provider.upload("../escape.html", Buffer.from("no"))).rejects.toThrow(
      "Invalid storage path"
    );
    await expect(
      provider.upload("dashboards/user/../other/escape.html", Buffer.from("no"))
    ).rejects.toThrow("Invalid storage path");
    await expect(provider.download("/absolute.html")).rejects.toThrow("Invalid storage path");
  });
});

describe("getStorageProvider", () => {
  it("rejects an unknown provider", () => {
    process.env.STORAGE_PROVIDER = "unknown";

    expect(() => getStorageProvider()).toThrow(
      'Invalid STORAGE_PROVIDER "unknown". Expected "gcs" or "local".'
    );
  });
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
