const DEFAULT_CACHE_MAX_BYTES = 256 * 1024 * 1024;
const KEY_SEPARATOR = "::";

export interface SyncCacheKeyInput {
  sourceId: string;
  md5Hash?: string;
  etag?: string;
  configVersion: number | string;
}

export interface SyncCacheOptions {
  maxBytes?: number;
}

export interface SyncCacheLoadResult<T> {
  value: T;
  byteSize: number;
  md5Hash?: string;
  etag?: string;
}

interface CacheEntry<T = unknown> {
  value: T;
  byteSize: number;
}

export class SyncCacheKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncCacheKeyError";
    Object.setPrototypeOf(this, SyncCacheKeyError.prototype);
  }
}

export class SyncCacheSizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncCacheSizeError";
    Object.setPrototypeOf(this, SyncCacheSizeError.prototype);
  }
}

export class SyncCache {
  private readonly maxBytes: number;
  private readonly entries = new Map<string, CacheEntry>();
  private readonly loadMutex = new Map<string, Promise<unknown>>();
  private totalBytes = 0;

  constructor(opts: SyncCacheOptions = {}) {
    this.maxBytes = normalizeMaxBytes(opts.maxBytes);
  }

  get<T = unknown>(key: string): T | undefined {
    const entry = this.entries.get(key);

    if (!entry) {
      return undefined;
    }

    this.entries.delete(key);
    this.entries.set(key, entry);

    return entry.value as T;
  }

  set<T>(key: string, value: T, byteSize: number): void {
    validateCacheKey(key);
    const normalizedSize = normalizeEntrySize(byteSize);
    const previous = this.entries.get(key);

    if (previous) {
      this.totalBytes -= previous.byteSize;
      this.entries.delete(key);
    }

    if (normalizedSize > this.maxBytes) {
      return;
    }

    this.entries.set(key, { value, byteSize: normalizedSize });
    this.totalBytes += normalizedSize;
    this.evictUntilWithinLimit(key);
  }

  async getOrLoad<T>(
    key: string,
    loader: () => Promise<SyncCacheLoadResult<T>>,
  ): Promise<T> {
    const cached = this.get<T>(key);

    if (cached !== undefined) {
      return cached;
    }

    const inFlight = this.loadMutex.get(key);

    if (inFlight) {
      return inFlight as Promise<T>;
    }

    const loadPromise = loader()
      .then((loaded) => {
        this.set(key, loaded.value, loaded.byteSize);
        return loaded.value;
      })
      .finally(() => {
        if (this.loadMutex.get(key) === loadPromise) {
          this.loadMutex.delete(key);
        }
      });

    this.loadMutex.set(key, loadPromise);
    return loadPromise;
  }

  private evictUntilWithinLimit(protectedKey: string): void {
    for (const [key, entry] of this.entries) {
      if (this.totalBytes <= this.maxBytes) {
        return;
      }

      if (key === protectedKey && this.entries.size === 1) {
        return;
      }

      this.entries.delete(key);
      this.totalBytes -= entry.byteSize;
    }
  }
}

export function createSyncCacheKey(input: SyncCacheKeyInput): string {
  const contentHash = input.md5Hash || input.etag;

  if (!input.sourceId || input.sourceId.includes(KEY_SEPARATOR)) {
    throw new SyncCacheKeyError("sourceId inválido para chave de cache");
  }

  if (!contentHash || contentHash.includes(KEY_SEPARATOR)) {
    throw new SyncCacheKeyError("hash de conteúdo inválido para chave de cache");
  }

  const configVersion = String(input.configVersion);

  if (!configVersion || configVersion.includes(KEY_SEPARATOR)) {
    throw new SyncCacheKeyError("configVersion inválida para chave de cache");
  }

  return [input.sourceId, contentHash, configVersion].join(KEY_SEPARATOR);
}

function validateCacheKey(key: string): void {
  const parts = key.split(KEY_SEPARATOR);

  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    throw new SyncCacheKeyError("Chave de cache inválida");
  }
}

function normalizeMaxBytes(value: number | undefined): number {
  const limit = value ?? readEnvByteLimit("TWD_CACHE_MAX_BYTES", DEFAULT_CACHE_MAX_BYTES);

  if (!Number.isFinite(limit) || limit <= 0) {
    throw new SyncCacheSizeError("maxBytes deve ser maior que zero");
  }

  return Math.floor(limit);
}

function normalizeEntrySize(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new SyncCacheSizeError("byteSize deve ser maior ou igual a zero");
  }

  return Math.floor(value);
}

function readEnvByteLimit(name: string, fallback: number): number {
  const raw = process.env[name];

  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
