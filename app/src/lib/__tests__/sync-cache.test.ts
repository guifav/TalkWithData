import { describe, expect, it, vi } from "vitest";
import { SyncCache, createSyncCacheKey } from "@/lib/data-sources/sync-cache";

describe("SyncCache", () => {
  it("faz cache hit por md5 e não chama loader no segundo acesso", async () => {
    const cache = new SyncCache({ maxBytes: 1024 });
    const key = createSyncCacheKey({
      sourceId: "source-a",
      md5Hash: "md5-a",
      configVersion: 1,
    });
    const loader = vi.fn(async () => ({
      value: Buffer.from("csv-a"),
      byteSize: 5,
      md5Hash: "md5-a",
    }));

    const first = await cache.getOrLoad(key, loader);
    const second = await cache.getOrLoad(key, loader);

    expect(first).toBe(second);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("recarrega quando o hash de conteúdo muda", async () => {
    const cache = new SyncCache({ maxBytes: 1024 });
    const keyA = createSyncCacheKey({
      sourceId: "source-a",
      md5Hash: "md5-a",
      configVersion: 1,
    });
    const keyB = createSyncCacheKey({
      sourceId: "source-a",
      md5Hash: "md5-b",
      configVersion: 1,
    });
    const loaderA = vi.fn(async () => ({
      value: Buffer.from("csv-a"),
      byteSize: 5,
      md5Hash: "md5-a",
    }));
    const loaderB = vi.fn(async () => ({
      value: Buffer.from("csv-b"),
      byteSize: 5,
      md5Hash: "md5-b",
    }));

    await cache.getOrLoad(keyA, loaderA);
    const result = await cache.getOrLoad(keyB, loaderB);

    expect(result).toEqual(Buffer.from("csv-b"));
    expect(loaderA).toHaveBeenCalledTimes(1);
    expect(loaderB).toHaveBeenCalledTimes(1);
  });

  it("usa mutex por sourceId para evitar dois loads concorrentes", async () => {
    const cache = new SyncCache({ maxBytes: 1024 });
    const key = createSyncCacheKey({
      sourceId: "source-a",
      md5Hash: "md5-a",
      configVersion: 1,
    });
    let resolveLoader: (value: { value: Buffer; byteSize: number; md5Hash: string }) => void;
    const loaderPromise = new Promise<{ value: Buffer; byteSize: number; md5Hash: string }>(
      (resolve) => {
        resolveLoader = resolve;
      },
    );
    const loader = vi.fn(() => loaderPromise);

    const first = cache.getOrLoad(key, loader);
    const second = cache.getOrLoad(key, loader);
    resolveLoader!({ value: Buffer.from("csv-a"), byteSize: 5, md5Hash: "md5-a" });

    await expect(Promise.all([first, second])).resolves.toEqual([
      Buffer.from("csv-a"),
      Buffer.from("csv-a"),
    ]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("evicta a entrada LRU quando ultrapassa o limite por bytes", () => {
    const cache = new SyncCache({ maxBytes: 10 });
    const keyA = createSyncCacheKey({
      sourceId: "source-a",
      md5Hash: "md5-a",
      configVersion: 1,
    });
    const keyB = createSyncCacheKey({
      sourceId: "source-b",
      md5Hash: "md5-b",
      configVersion: 1,
    });
    const keyC = createSyncCacheKey({
      sourceId: "source-c",
      md5Hash: "md5-c",
      configVersion: 1,
    });

    cache.set(keyA, Buffer.from("aaaa"), 4);
    cache.set(keyB, Buffer.from("bbbb"), 4);
    cache.get(keyA);
    cache.set(keyC, Buffer.from("cccc"), 4);

    expect(cache.get(keyA)).toEqual(Buffer.from("aaaa"));
    expect(cache.get(keyB)).toBeUndefined();
    expect(cache.get(keyC)).toEqual(Buffer.from("cccc"));
  });

  it("troca referência no set sem mutar entry existente", () => {
    const cache = new SyncCache({ maxBytes: 1024 });
    const key = createSyncCacheKey({
      sourceId: "source-a",
      md5Hash: "md5-a",
      configVersion: 1,
    });
    const first = { rows: [["1"]] };
    const second = { rows: [["2"]] };

    cache.set(key, first, 1);
    const cachedFirst = cache.get(key);
    cache.set(key, second, 1);
    const cachedSecond = cache.get(key);

    expect(cachedFirst).toBe(first);
    expect(cachedSecond).toBe(second);
    expect(cachedSecond).not.toBe(cachedFirst);
    expect(first).toEqual({ rows: [["1"]] });
  });

  it("aceita etag como fallback para a chave de conteúdo", () => {
    expect(
      createSyncCacheKey({
        sourceId: "source-a",
        etag: "etag-a",
        configVersion: 1,
      }),
    ).toBe("source-a::etag-a::1");
  });
});
