import { createCipheriv } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEV_ENC_KEY,
  SecretService,
  type CredentialRef,
} from "@/lib/data-sources/credentials";

const fakeServiceAccount = {
  type: "service_account",
  project_id: "fake-project",
  private_key_id: "fake-key-id",
  private_key: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n",
  client_email: "external-source@example.test",
};

describe("SecretService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("resolve encryptedBlob descriptografando AES-GCM e parseando JSON", async () => {
    const encrypted = encryptFixture(fakeServiceAccount);
    const service = new SecretService({
      loadEncryptedBlob: async () => encrypted,
    });

    await expect(
      service.resolve({ kind: "encryptedBlob", ref: "data-source-a" }),
    ).resolves.toEqual(fakeServiceAccount);
  });

  it("criptografa credencial e permite round trip pelo mesmo formato", async () => {
    const encryptingService = new SecretService({
      encryptionKeyBase64: DEV_ENC_KEY,
    });
    const encrypted = encryptingService.encrypt(fakeServiceAccount);
    const resolvingService = new SecretService({
      encryptionKeyBase64: DEV_ENC_KEY,
      loadEncryptedBlob: async () => encrypted,
    });

    await expect(
      resolvingService.resolve({ kind: "encryptedBlob", ref: "data-source-a" }),
    ).resolves.toEqual(fakeServiceAccount);
  });

  it("gera IV novo para cada criptografia da mesma credencial", () => {
    const service = new SecretService({ encryptionKeyBase64: DEV_ENC_KEY });

    const first = service.encrypt(fakeServiceAccount);
    const second = service.encrypt(fakeServiceAccount);

    expect(first.equals(second)).toBe(false);
  });

  it("exige TWD_CREDENTIAL_ENC_KEY em produção ao criptografar", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TWD_CREDENTIAL_ENC_KEY", "");
    const service = new SecretService();

    expect(() => service.encrypt(fakeServiceAccount)).toThrow(
      "TWD_CREDENTIAL_ENC_KEY e obrigatorio em producao",
    );
  });

  it("lança para secretManager enquanto a integração está reservada", async () => {
    const service = new SecretService();
    const ref: CredentialRef = { kind: "secretManager", ref: "projects/p/secrets/s" };

    await expect(service.resolve(ref)).rejects.toThrow("secretManager still not implemented");
  });

  it("exige TWD_CREDENTIAL_ENC_KEY em produção (não usa DEV_ENC_KEY)", async () => {
    const encrypted = encryptFixture(fakeServiceAccount);
    const service = new SecretService({
      loadEncryptedBlob: async () => encrypted,
    });

    vi.stubEnv("NODE_ENV", "production");

    await expect(
      service.resolve({ kind: "encryptedBlob", ref: "data-source-a" }),
    ).rejects.toThrow("TWD_CREDENTIAL_ENC_KEY e obrigatorio em producao");
  });

  it("usa TWD_CREDENTIAL_ENC_KEY em produção quando presente", async () => {
    const encrypted = encryptFixture(fakeServiceAccount);
    const service = new SecretService({
      loadEncryptedBlob: async () => encrypted,
    });

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TWD_CREDENTIAL_ENC_KEY", DEV_ENC_KEY);

    await expect(
      service.resolve({ kind: "encryptedBlob", ref: "data-source-a" }),
    ).resolves.toEqual(fakeServiceAccount);
  });

  it("usa cache TTL para não reler o blob criptografado dentro da janela", async () => {
    let now = 1_000;
    const encrypted = encryptFixture(fakeServiceAccount);
    const loader = vi.fn(async () => encrypted);
    const service = new SecretService({
      ttlMs: 500,
      now: () => now,
      loadEncryptedBlob: loader,
    });
    const ref: CredentialRef = { kind: "encryptedBlob", ref: "data-source-a" };

    await service.resolve(ref);
    now += 499;
    await service.resolve(ref);
    now += 2;
    await service.resolve(ref);

    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("não loga material sensível durante resolve", async () => {
    const encrypted = encryptFixture(fakeServiceAccount);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const service = new SecretService({
      loadEncryptedBlob: async () => encrypted,
    });

    const resolved = await service.resolve({ kind: "encryptedBlob", ref: "data-source-a" });
    const consolePayload = [...logSpy.mock.calls, ...errorSpy.mock.calls]
      .flat()
      .map(String)
      .join("\n");

    expect(resolved).toEqual(fakeServiceAccount);
    expect(consolePayload).not.toContain(fakeServiceAccount.private_key);
    expect(consolePayload).not.toContain(fakeServiceAccount.client_email);
    expect(consolePayload).not.toContain(JSON.stringify(fakeServiceAccount));
    expect(resolved).not.toHaveProperty("credentialEnc");
    expect(resolved).not.toHaveProperty("credentialRef");
  });
});

function encryptFixture(payload: object): Buffer {
  const key = Buffer.from(DEV_ENC_KEY, "base64");
  const iv = Buffer.alloc(12, 7);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, ciphertext]);
}
