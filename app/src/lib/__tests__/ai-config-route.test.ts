import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const routeMocks = vi.hoisted(() => ({
  verifySuperAdmin: vi.fn(),
  updateUserAiConfig: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  verifySuperAdmin: routeMocks.verifySuperAdmin,
}));

vi.mock("@/lib/ai-config-secrets", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai-config-secrets")>();
  return {
    ...actual,
    updateUserAiConfig: routeMocks.updateUserAiConfig,
  };
});

const { AiConfigSecretError } = await import("@/lib/ai-config-secrets");
const { GET, PUT } = await import("@/app/api/admin/ai-config/route");

function request(method: "GET" | "PUT", body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/ai-config", {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe("admin AI config route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.verifySuperAdmin.mockResolvedValue({ uid: "superadmin-1" });
    routeMocks.updateUserAiConfig.mockResolvedValue({
      provider: "custom",
      model: "model-a",
      baseUrl: "https://llm.example.test/v1",
      apiKeyConfigured: true,
    });
  });

  it("nega GET sem superadmin", async () => {
    routeMocks.verifySuperAdmin.mockResolvedValue(null);

    const response = await GET(request("GET"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("retorna somente metadados suportados para superadmin", async () => {
    const response = await GET(request("GET"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.defaultConfig).toEqual(expect.objectContaining({ provider: expect.any(String) }));
    expect(body.supportedModels).toEqual(expect.any(Object));
    expect(JSON.stringify(body)).not.toContain("apiKey");
  });

  it("nega PUT antes de tocar secrets", async () => {
    routeMocks.verifySuperAdmin.mockResolvedValue(null);

    const response = await PUT(request("PUT", { uid: "user-1", aiConfig: null }));

    expect(response.status).toBe(403);
    expect(routeMocks.updateUserAiConfig).not.toHaveBeenCalled();
  });

  it.each([undefined, null, "", "   ", 42, [], {}])(
    "rejeita uid inválido: %j",
    async (uid) => {
      const response = await PUT(request("PUT", { uid, aiConfig: null }));

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "uid is required" });
      expect(routeMocks.updateUserAiConfig).not.toHaveBeenCalled();
    },
  );

  it("exige aiConfig no contrato HTTP", async () => {
    const response = await PUT(request("PUT", { uid: "user-1" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "aiConfig is required" });
    expect(routeMocks.updateUserAiConfig).not.toHaveBeenCalled();
  });

  it("persiste configuração validada e propaga keepExistingApiKey", async () => {
    const aiConfig = {
      provider: "custom",
      model: "model-a",
      baseUrl: "https://llm.example.test/v1",
      apiKey: "secret-never-returned",
    };

    const response = await PUT(
      request("PUT", { uid: " user-1 ", aiConfig, keepExistingApiKey: true }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(routeMocks.updateUserAiConfig).toHaveBeenCalledWith(
      " user-1 ",
      aiConfig,
      { keepExistingApiKey: true },
    );
    expect(body).toEqual({
      success: true,
      uid: " user-1 ",
      aiConfig: {
        provider: "custom",
        model: "model-a",
        baseUrl: "https://llm.example.test/v1",
        apiKeyConfigured: true,
      },
    });
    expect(JSON.stringify(body)).not.toContain("secret-never-returned");
  });

  it("mantém status seguro de erro tipado", async () => {
    routeMocks.updateUserAiConfig.mockRejectedValue(
      new AiConfigSecretError("User not found", 404),
    );

    const response = await PUT(request("PUT", { uid: "missing", aiConfig: null }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "User not found" });
  });

  it("sanitiza falha inesperada", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    routeMocks.updateUserAiConfig.mockRejectedValue(new Error("database unavailable"));

    const response = await PUT(request("PUT", { uid: "user-1", aiConfig: null }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Failed to update AI config" });
    expect(consoleError).toHaveBeenCalledOnce();
  });
});

