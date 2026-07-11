import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { exists: boolean; data: Record<string, unknown> };

const collections = new Map<string, Map<string, StoredDoc>>();

function collectionStore(name: string) {
  let store = collections.get(name);
  if (!store) {
    store = new Map<string, StoredDoc>();
    collections.set(name, store);
  }
  return store;
}

function docRef(collectionName: string, id: string) {
  const store = collectionStore(collectionName);
  return {
    id,
    get: vi.fn(async () => {
      const doc = store.get(id);
      return {
        exists: doc?.exists ?? false,
        data: () => doc?.data,
      };
    }),
    set: vi.fn(async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
      const current = store.get(id);
      store.set(id, {
        exists: true,
        data: opts?.merge && current?.exists ? { ...current.data, ...data } : { ...data },
      });
    }),
    update: vi.fn(async (data: Record<string, unknown>) => {
      const current = store.get(id);
      if (!current?.exists) throw new Error("not found");
      store.set(id, {
        exists: true,
        data: { ...current.data, ...data },
      });
    }),
    delete: vi.fn(async () => {
      store.delete(id);
    }),
  };
}

vi.mock("@/lib/firebase/admin", () => ({
  adminDb: {
    collection: (name: string) => ({
      doc: (id: string) => docRef(name, id),
    }),
  },
}));

const {
  DEV_AI_CONFIG_ENC_KEY,
  decryptApiKey,
  encryptApiKey,
  updateUserAiConfig,
} = await import("@/lib/ai-config-secrets");
const { resolveUserModel } = await import("@/lib/ai-model");

describe("AI config server-only secrets", () => {
  beforeEach(() => {
    collections.clear();
    vi.unstubAllEnvs();
    collectionStore("users").set("user-a", {
      exists: true,
      data: { role: "user" },
    });
  });

  it("encrypts and decrypts API keys with AES-GCM", () => {
    const encrypted = encryptApiKey("sk-custom", DEV_AI_CONFIG_ENC_KEY);

    expect(encrypted).not.toContain("sk-custom");
    expect(decryptApiKey(encrypted, DEV_AI_CONFIG_ENC_KEY)).toBe("sk-custom");
  });

  it("stores custom provider keys outside the user document", async () => {
    const stored = await updateUserAiConfig("user-a", {
      provider: "custom",
      model: "custom-model",
      baseUrl: "https://llm.example.test/v1",
      apiKey: "sk-custom",
    });

    const userDoc = collectionStore("users").get("user-a")?.data;
    const secretDoc = collectionStore("ai_config_secrets").get("user-a")?.data;

    expect(stored).toEqual({
      provider: "custom",
      model: "custom-model",
      baseUrl: "https://llm.example.test/v1",
      apiKeyConfigured: true,
    });
    expect(userDoc?.aiConfig).toEqual(stored);
    expect(JSON.stringify(userDoc)).not.toContain("sk-custom");
    expect(secretDoc?.apiKeyEnc).toEqual(expect.any(String));
    expect(secretDoc?.apiKeyEnc).not.toContain("sk-custom");
  });

  it("keeps an existing encrypted key when requested", async () => {
    await updateUserAiConfig("user-a", {
      provider: "custom",
      model: "custom-model",
      baseUrl: "https://llm.example.test/v1",
      apiKey: "sk-original",
    });
    const originalSecret = collectionStore("ai_config_secrets").get("user-a")?.data.apiKeyEnc;

    const stored = await updateUserAiConfig("user-a", {
      provider: "custom",
      model: "custom-model-large",
      baseUrl: "https://llm.example.test/v2",
    }, { keepExistingApiKey: true });

    expect(stored?.apiKeyConfigured).toBe(true);
    expect(collectionStore("ai_config_secrets").get("user-a")?.data.apiKeyEnc).toBe(originalSecret);
  });

  it("migrates a legacy key during keep-existing update and removes plaintext", async () => {
    collectionStore("users").set("user-a", {
      exists: true,
      data: {
        aiConfig: {
          provider: "custom",
          model: "custom-model",
          baseUrl: "https://llm.example.test/v1",
          apiKey: "sk-legacy",
        },
      },
    });

    await updateUserAiConfig("user-a", {
      provider: "custom",
      model: "custom-model",
      baseUrl: "https://llm.example.test/v1",
    }, { keepExistingApiKey: true });

    const userDoc = collectionStore("users").get("user-a")?.data;
    expect(JSON.stringify(userDoc)).not.toContain("sk-legacy");
    expect(collectionStore("ai_config_secrets").get("user-a")?.data.apiKeyEnc).toEqual(expect.any(String));
  });

  it("deletes server-side keys when config is cleared or changed to built-in provider", async () => {
    await updateUserAiConfig("user-a", {
      provider: "custom",
      model: "custom-model",
      baseUrl: "https://llm.example.test/v1",
      apiKey: "sk-custom",
    });

    await updateUserAiConfig("user-a", {
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
    });
    expect(collectionStore("ai_config_secrets").get("user-a")).toBeUndefined();

    await updateUserAiConfig("user-a", {
      provider: "custom",
      model: "custom-model",
      baseUrl: "https://llm.example.test/v1",
      apiKey: "sk-custom",
    });
    await updateUserAiConfig("user-a", null);

    expect(collectionStore("users").get("user-a")?.data.aiConfig).toBeNull();
    expect(collectionStore("ai_config_secrets").get("user-a")).toBeUndefined();
  });

  it("resolves custom provider credentials from the server-only collection", async () => {
    await updateUserAiConfig("user-a", {
      provider: "custom",
      model: "custom-model",
      baseUrl: "https://llm.example.test/v1",
      apiKey: "sk-custom",
    });

    const resolved = await resolveUserModel("user-a");

    expect(resolved.config).toMatchObject({
      provider: "custom",
      model: "custom-model",
      baseUrl: "https://llm.example.test/v1",
      apiKey: "sk-custom",
    });
  });
});
