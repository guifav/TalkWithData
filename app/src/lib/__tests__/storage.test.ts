import { Storage } from "@google-cloud/storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ExternalStorageConfigError,
  ExternalStoragePathError,
  ExternalStorageReadTooLargeError,
  createGcsStorage,
} from "@/lib/data-sources/storage";

const gcsMocks = vi.hoisted(() => ({
  bucket: vi.fn(),
  getFiles: vi.fn(),
  file: vi.fn(),
  getMetadata: vi.fn(),
  download: vi.fn(),
}));

vi.mock("@google-cloud/storage", () => ({
  Storage: vi.fn(function StorageMock() {
    return {
    bucket: gcsMocks.bucket,
    };
  }),
}));

const credentials = {
  project_id: "project-a",
  client_email: "svc@example.test",
  private_key: "fake-key",
};

describe("createGcsStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gcsMocks.bucket.mockReturnValue({
      getFiles: gcsMocks.getFiles,
      file: gcsMocks.file,
    });
    gcsMocks.file.mockReturnValue({
      getMetadata: gcsMocks.getMetadata,
      download: gcsMocks.download,
    });
  });

  afterEach(() => {
    delete process.env.SA_KEY_JSON;
  });

  it("lista objetos com paginação e hash de conteúdo", async () => {
    gcsMocks.getFiles.mockResolvedValue([
      [
        { name: "exports/a.csv", metadata: { md5Hash: "md5-a" } },
        { name: "exports/b.csv", metadata: { etag: "etag-b" } },
      ],
      { pageToken: "next-page" },
    ]);

    const storage = createGcsStorage({
      bucketName: "external-bucket",
      credentials,
    });

    await expect(
      storage.list("exports/", { pageToken: "page-1", maxResults: 2 }),
    ).resolves.toEqual({
      objects: [
        { name: "exports/a.csv", md5Hash: "md5-a" },
        { name: "exports/b.csv", md5Hash: "etag-b" },
      ],
      nextPageToken: "next-page",
    });

    expect(Storage).toHaveBeenCalledWith({
      credentials,
      projectId: "project-a",
    });
    expect(gcsMocks.bucket).toHaveBeenCalledWith("external-bucket");
    expect(gcsMocks.getFiles).toHaveBeenCalledWith({
      prefix: "exports/",
      pageToken: "page-1",
      maxResults: 2,
      autoPaginate: false,
    });
  });

  it("lê objeto por chave retornando conteúdo e md5", async () => {
    const content = Buffer.from("a,b\n1,2\n", "utf8");
    gcsMocks.getMetadata.mockResolvedValue([{ size: String(content.length), md5Hash: "md5-csv" }]);
    gcsMocks.download.mockResolvedValue([content]);

    const storage = createGcsStorage({
      bucketName: "external-bucket",
      credentials,
    });

    await expect(storage.readByKey("exports/a.csv")).resolves.toEqual({
      content,
      md5Hash: "md5-csv",
    });

    expect(gcsMocks.file).toHaveBeenCalledWith("exports/a.csv");
    expect(gcsMocks.download).toHaveBeenCalledTimes(1);
  });

  it("prende a geração do metadata no file() ao baixar", async () => {
    const content = Buffer.from("a,b\n1,2\n", "utf8");
    gcsMocks.getMetadata.mockResolvedValue([
      { size: String(content.length), md5Hash: "md5-csv", generation: "123" },
    ]);
    gcsMocks.download.mockResolvedValue([content]);

    const storage = createGcsStorage({
      bucketName: "external-bucket",
      credentials,
    });

    await expect(storage.readByKey("exports/a.csv")).resolves.toEqual({
      content,
      md5Hash: "md5-csv",
    });

    expect(gcsMocks.file).toHaveBeenCalledWith("exports/a.csv", { generation: "123" });
  });

  it("lança erro tipado se bucketName ou credentials estiverem ausentes", () => {
    process.env.SA_KEY_JSON = JSON.stringify({ project_id: "global-project" });

    expect(() => createGcsStorage({ bucketName: "", credentials })).toThrow(
      ExternalStorageConfigError,
    );
    expect(() =>
      createGcsStorage({ bucketName: "external-bucket", credentials: undefined as never }),
    ).toThrow(ExternalStorageConfigError);

    expect(Storage).not.toHaveBeenCalled();
  });

  it.each(["../secret.csv", "exports/../secret.csv", "/absolute.csv", "C:\\tmp\\a.csv"])(
    "rejeita path inválido %s",
    async (unsafePath) => {
      const storage = createGcsStorage({
        bucketName: "external-bucket",
        credentials,
      });

      await expect(storage.list(unsafePath)).rejects.toBeInstanceOf(ExternalStoragePathError);
      await expect(storage.readByKey(unsafePath)).rejects.toBeInstanceOf(
        ExternalStoragePathError,
      );
    },
  );

  it("rejeita path com byte nulo", async () => {
    const storage = createGcsStorage({
      bucketName: "external-bucket",
      credentials,
    });

    await expect(storage.readByKey("exports/a\0.csv")).rejects.toBeInstanceOf(
      ExternalStoragePathError,
    );
  });

  it("bloqueia leitura acima de maxBytes sem baixar o objeto", async () => {
    gcsMocks.getMetadata.mockResolvedValue([{ size: "6", md5Hash: "md5-big" }]);

    const storage = createGcsStorage({
      bucketName: "external-bucket",
      credentials,
    });

    await expect(storage.readByKey("exports/big.csv", { maxBytes: 5 })).rejects.toBeInstanceOf(
      ExternalStorageReadTooLargeError,
    );

    expect(gcsMocks.download).not.toHaveBeenCalled();
  });
});
