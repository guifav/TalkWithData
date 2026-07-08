import { createDecipheriv } from "crypto";

const DEFAULT_CREDENTIAL_TTL_MS = 5 * 60 * 1000;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

// Chave dummy apenas para testes unitários e desenvolvimento local.
// Em produção, TWD_CREDENTIAL_ENC_KEY é obrigatório.
export const DEV_ENC_KEY = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";

export type CredentialRef =
  | { kind: "encryptedBlob"; ref: string }
  | { kind: "secretManager"; ref: string };

export interface SecretServiceOptions {
  ttlMs?: number;
  now?: () => number;
  loadEncryptedBlob?: (ref: string) => Promise<Buffer>;
  encryptionKeyBase64?: string;
}

export class CredentialConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialConfigError";
    Object.setPrototypeOf(this, CredentialConfigError.prototype);
  }
}

export class CredentialDecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialDecryptionError";
    Object.setPrototypeOf(this, CredentialDecryptionError.prototype);
  }
}

export class SecretService {
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly blobLoader: (ref: string) => Promise<Buffer>;
  private readonly encryptionKeyBase64?: string;
  private readonly cache = new Map<string, { expiresAt: number; value: object }>();

  constructor(opts: SecretServiceOptions = {}) {
    this.ttlMs = normalizeTtl(opts.ttlMs);
    this.now = opts.now ?? Date.now;
    this.blobLoader = opts.loadEncryptedBlob ?? loadEncryptedBlob;
    this.encryptionKeyBase64 = opts.encryptionKeyBase64;
  }

  async resolve(ref: CredentialRef): Promise<object> {
    if (ref.kind === "secretManager") {
      throw new Error("secretManager still not implemented");
    }

    const cacheKey = `${ref.kind}:${ref.ref}`;
    const cached = this.cache.get(cacheKey);
    const currentTime = this.now();

    if (cached && cached.expiresAt > currentTime) {
      return cached.value;
    }

    const encryptedBlob = await this.blobLoader(ref.ref);
    const value = decryptCredentialBlob(encryptedBlob, getEncryptionKey(this.encryptionKeyBase64));

    this.cache.set(cacheKey, {
      expiresAt: currentTime + this.ttlMs,
      value,
    });

    return value;
  }
}

export async function loadEncryptedBlob(_ref: string): Promise<Buffer> {
  throw new Error("not implemented in this slice");
}

function decryptCredentialBlob(blob: Buffer, key: Buffer): object {
  if (blob.length <= IV_BYTES + AUTH_TAG_BYTES) {
    throw new CredentialDecryptionError("Blob de credencial inválido");
  }

  const iv = blob.subarray(0, IV_BYTES);
  const authTag = blob.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
  const ciphertext = blob.subarray(IV_BYTES + AUTH_TAG_BYTES);

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const parsed = JSON.parse(plaintext.toString("utf8")) as unknown;

    if (!isPlainObject(parsed)) {
      throw new CredentialDecryptionError("Credencial descriptografada não é um objeto JSON");
    }

    return parsed;
  } catch (error) {
    if (error instanceof CredentialDecryptionError) {
      throw error;
    }

    throw new CredentialDecryptionError("Falha ao descriptografar credencial");
  }
}

function getEncryptionKey(explicitKeyBase64: string | undefined): Buffer {
  const keyBase64 = explicitKeyBase64 ?? process.env.TWD_CREDENTIAL_ENC_KEY;

  if (!keyBase64) {
    if (process.env.NODE_ENV === "production") {
      throw new CredentialConfigError(
        "TWD_CREDENTIAL_ENC_KEY e obrigatorio em producao",
      );
    }

    return Buffer.from(DEV_ENC_KEY, "base64");
  }

  const key = Buffer.from(keyBase64, "base64");

  if (key.length !== 32) {
    throw new CredentialConfigError("TWD_CREDENTIAL_ENC_KEY deve ter 32 bytes em base64");
  }

  return key;
}

function normalizeTtl(ttlMs: number | undefined): number {
  if (ttlMs === undefined) {
    return DEFAULT_CREDENTIAL_TTL_MS;
  }

  if (!Number.isFinite(ttlMs) || ttlMs < 0) {
    throw new CredentialConfigError("ttlMs deve ser maior ou igual a zero");
  }

  return Math.floor(ttlMs);
}

function isPlainObject(value: unknown): value is object {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
