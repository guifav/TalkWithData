import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCipheriv } from "crypto";

// NÃO mockamos @/lib/data-sources/credentials: queremos exercitar o
// SecretService REAL (AES-GCM) de ponta a ponta, provando que o fluxo de
// produção descriptografa a credencial GCS a partir do credentialEnc.
const getDataSourceWithCredentials = vi.fn();
const createGcsStorage = vi.fn();

vi.mock("@/lib/data-sources/firestore", () => ({
  getDataSourceWithCredentials: (id: string) => getDataSourceWithCredentials(id),
}));

vi.mock("@/lib/data-sources/storage", () => ({
  createGcsStorage: (opts: object) => createGcsStorage(opts),
}));

import { readDataSourceCsv } from "@/lib/data-sources/query";
import { DEV_ENC_KEY } from "@/lib/data-sources/credentials";

// Chave de desenvolvimento (32 bytes em base64) usada pelo SecretService quando
// TWD_CREDENTIAL_ENC_KEY ausente. Criptografamos o fixture com ela.
const KEY = Buffer.from(DEV_ENC_KEY, "base64");

function makeCredentialBlob(plaintext: object): string {
  const iv = Buffer.from("0123456789ab"); // 12 bytes fixos p/ fixture
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(plaintext), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

const FAKE_CREDS = {
  projectId: "proj-fake",
  client_email: "svc@proj-fake.iam.gserviceaccount.com",
  private_key: "[REDACTED PRIVATE KEY]",
};

const CSV_BYTES = Buffer.from("owner,amount\nana,10\nbob,20\n");

function makeMeta(extra: Record<string, unknown> = {}) {
  return {
    id: "ds1",
    kind: "csv" as const,
    orgId: "org",
    bucket: "bucket-x",
    prefix: "exports/",
    ownerColumn: "owner",
    accessGrants: { assignedUsers: ["u1"], assignedDepartments: [] },
    configVersion: 1,
    createdBy: "u1",
    updatedAt: "2026-07-08T00:00:00.000Z",
    ...extra,
  };
}

describe("readDataSourceCsv (P1.7, fluxo real de credencial)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createGcsStorage.mockReturnValue({
      list: async () => ({
        objects: [{ name: "exports/data.csv", md5Hash: "h1" }],
      }),
      readByKey: async () => ({ content: CSV_BYTES, md5Hash: "h1" }),
    });
  });

  it("descriptografa credentialEnc com SecretService real e le o CSV", async () => {
    const blob = makeCredentialBlob(FAKE_CREDS);
    getDataSourceWithCredentials.mockResolvedValue(
      makeMeta({
        credentialRef: { kind: "encryptedBlob" as const, ref: "r1" },
        credentialEnc: blob,
      }),
    );

    const result = await readDataSourceCsv(makeMeta());

    expect(result.etag).toBe("h1");
    expect(result.csvBuffer.equals(CSV_BYTES)).toBe(true);
    // A credencial descriptografada foi passada ao storage GCS real.
    expect(createGcsStorage).toHaveBeenCalledWith({
      bucketName: "bucket-x",
      credentials: FAKE_CREDS,
    });
  });

  it("falha fechado quando nao ha credentialEnc", async () => {
    getDataSourceWithCredentials.mockResolvedValue(
      makeMeta({
        credentialRef: { kind: "encryptedBlob" as const, ref: "r1" },
        // sem credentialEnc
      }),
    );

    await expect(readDataSourceCsv(makeMeta())).rejects.toThrow(
      /sem credentialEnc/,
    );
  });

  it("bloqueia cedo credentialRef secretManager (ainda nao implementado)", async () => {
    getDataSourceWithCredentials.mockResolvedValue(
      makeMeta({
        credentialRef: { kind: "secretManager" as const, ref: "sm1" },
        credentialEnc: makeCredentialBlob(FAKE_CREDS),
      }),
    );

    await expect(readDataSourceCsv(makeMeta())).rejects.toThrow(
      /secretManager/,
    );
  });
});
