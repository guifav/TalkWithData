import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
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
