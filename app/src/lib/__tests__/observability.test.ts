import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createCorrelationId,
  observeStorageOperation,
  serializeOperationalEvent,
  withCorrelationId,
  writeOperationalEvent,
} from "@/lib/observability";

const sensitiveMetadata = {
  authorization: "Bearer auth-secret",
  cookie: "dash_session=cookie-secret",
  apiKey: "provider-secret",
  provider_key: "provider-key-secret",
  serviceAccount: { client_email: "robot@example.com", private_key: "private-secret" },
  credentialEnc: "encrypted-secret",
  dashboardCapability: "capability-secret",
  prompt: "private prompt text",
  rows: [{ customer: "private row value" }],
  uploadedDocumentContents: "private document text",
  storagePath: "dashboards/private/index.html",
  databaseUrl: "postgresql://operator:database-secret@private-db/app",
  connectionString: "postgresql://operator:connection-secret@connection-db/app",
  pgUrl: "postgresql://operator:pg-secret@pg-db/app",
  password: "password-secret",
  passwd: "passwd-secret",
  pwd: "pwd-secret",
  passphrase: "passphrase-secret",
  saKeyJson: "service-account-json-secret",
  fallbackBucketAlias: "private-bucket",
  requestBody: { title: "private request title" },
  ownerEmail: "person@example.com",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("serializeOperationalEvent", () => {
  it("remove nomes e valores sensíveis em qualquer profundidade", () => {
    const serialized = serializeOperationalEvent({
      level: "error",
      event: "request.upload.failed",
      correlationId: "request-12345678",
      metadata: {
        timestamp: "spoofed",
        level: "info",
        event: "storage.operation.succeeded",
        correlationId: "spoofed",
        operation: "upload",
        nested: sensitiveMetadata,
        list: [sensitiveMetadata],
        rowCount: 3,
        keyCount: 4,
      },
    }, { now: () => new Date("2026-07-11T21:00:00.000Z") });

    expect(JSON.parse(serialized)).toEqual({
      timestamp: "2026-07-11T21:00:00.000Z",
      level: "error",
      event: "request.upload.failed",
      correlationId: "request-12345678",
      operation: "upload",
      nested: {},
      list: [{}],
      rowCount: 3,
      keyCount: 4,
    });

    for (const forbidden of [
      ...Object.keys(sensitiveMetadata),
      "client_email",
      "private_key",
      "auth-secret",
      "cookie-secret",
      "provider-secret",
      "private prompt text",
      "private row value",
      "private document text",
      "person@example.com",
      "private-db",
      "connection-db",
      "pg-db",
      "password-secret",
      "passwd-secret",
      "pwd-secret",
      "passphrase-secret",
      "service-account-json-secret",
      "private-bucket",
      "spoofed",
    ]) {
      expect(serialized.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("serializa erros sem mensagem, stack, cause ou propriedades arbitrárias", () => {
    const error = Object.assign(new Error("database password is hunter2"), {
      code: "ECONNREFUSED",
      status: 503,
      authorization: "Bearer secret",
    });

    const serialized = serializeOperationalEvent({
      level: "error",
      event: "storage.operation.failed",
      correlationId: "storage-12345678",
      metadata: { error },
    });

    expect(JSON.parse(serialized).error).toEqual({
      name: "Error",
      code: "ECONNREFUSED",
      status: 503,
    });
    expect(serialized).not.toContain("hunter2");
    expect(serialized).not.toContain("Bearer secret");
    expect(serialized).not.toContain("stack");
    expect(serialized).not.toContain("cause");
  });

  it("limita profundidade, coleções, strings e referências circulares", () => {
    const circular: Record<string, unknown> = { value: "safe" };
    circular.self = circular;

    const parsed = JSON.parse(serializeOperationalEvent({
      level: "info",
      event: "storage.operation.succeeded",
      correlationId: "storage-12345678",
      metadata: {
        text: "x".repeat(400),
        list: Array.from({ length: 30 }, (_, index) => index),
        deep: { one: { two: { three: { four: "hidden" } } } },
        circular,
      },
    }));

    expect(parsed.text).toHaveLength(256);
    expect(parsed.list).toHaveLength(20);
    expect(parsed.deep.one.two.three).toBe("[MAX_DEPTH]");
    expect(parsed.circular.self).toBe("[CIRCULAR]");
  });
});

describe("createCorrelationId", () => {
  it("preserva somente request IDs com formato seguro", () => {
    expect(createCorrelationId("018f52a2-7e1d-7c4b-9a80-123456789abc", () => "generated-id"))
      .toBe("018f52a2-7e1d-7c4b-9a80-123456789abc");
    expect(createCorrelationId("Bearer secret", () => "generated-id"))
      .toBe("generated-id");
    expect(createCorrelationId("secret-with-safe-characters", () => "generated-id"))
      .toBe("generated-id");
  });

  it("anexa o identificador sanitizado à resposta", () => {
    const response = withCorrelationId(
      new Response(null, { status: 204 }),
      "018f52a2-7e1d-7c4b-9a80-123456789abc",
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("x-request-id")).toBe("018f52a2-7e1d-7c4b-9a80-123456789abc");
  });
});

describe("writeOperationalEvent", () => {
  it("respeita o nível de produção e envia uma linha JSON ao sink correto", () => {
    vi.stubEnv("TWD_LOG_LEVEL", "warn");
    const sink = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    writeOperationalEvent({
      level: "info",
      event: "storage.operation.started",
      correlationId: "storage-12345678",
    }, { sink });
    writeOperationalEvent({
      level: "error",
      event: "storage.operation.failed",
      correlationId: "storage-12345678",
      metadata: sensitiveMetadata,
    }, { sink });

    expect(sink.info).not.toHaveBeenCalled();
    expect(sink.warn).not.toHaveBeenCalled();
    expect(sink.error).toHaveBeenCalledOnce();
    const serialized = sink.error.mock.calls[0][0] as string;
    expect(serialized).toContain('"event":"storage.operation.failed"');
    expect(serialized).not.toContain("provider-secret");
  });
});

describe("observeStorageOperation", () => {
  it("emite início e sucesso sem path ou buffer", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await expect(observeStorageOperation("upload", async () => "done", {
      bytes: 42,
      path: "dashboards/private/index.html",
      buffer: Buffer.from("private document"),
    }, {
      generateId: () => "storage-12345678",
      nowMs: (() => {
        const values = [100, 125];
        return () => values.shift() ?? 125;
      })(),
    })).resolves.toBe("done");

    expect(info).toHaveBeenCalledTimes(2);
    const output = info.mock.calls.flat().join("\n");
    expect(output).toContain('"event":"storage.operation.started"');
    expect(output).toContain('"event":"storage.operation.succeeded"');
    expect(output).toContain('"durationMs":25');
    expect(output).toContain('"bytes":42');
    expect(output).not.toContain("dashboards/private");
    expect(output).not.toContain("private document");
    expect(output).not.toContain('"path"');
    expect(output).not.toContain('"buffer"');
  });

  it("emite erro sanitizado e preserva a rejeição original", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = new Error("gs://private-bucket/secret.csv");

    await expect(observeStorageOperation("download", async () => {
      throw failure;
    }, undefined, {
      generateId: () => "storage-12345678",
      nowMs: () => 100,
    })).rejects.toBe(failure);

    expect(info).toHaveBeenCalledOnce();
    expect(errorLog).toHaveBeenCalledOnce();
    const output = errorLog.mock.calls[0][0] as string;
    expect(output).toContain('"event":"storage.operation.failed"');
    expect(output).toContain('"name":"Error"');
    expect(output).not.toContain("private-bucket");
    expect(output).not.toContain("secret.csv");
  });
});
