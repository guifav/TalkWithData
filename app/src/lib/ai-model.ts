/**
 * AI Model Resolver, centralizes provider and model selection for all AI routes.
 *
 * Priority:
 *   1. User aiConfig metadata in Firestore users/{uid}.aiConfig
 *   2. AI_DEFAULT_PROVIDER / AI_DEFAULT_MODEL env vars
 *   3. Built-in Anthropic default
 */

import { adminDb } from "@/lib/firebase/admin";
import { getUserAiConfigApiKey } from "@/lib/ai-config-secrets";
import {
  AI_PROVIDER_LABELS,
  AI_PROVIDER_VALUES,
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  SUPPORTED_MODELS,
  isAiProvider,
  type AiProvider,
} from "@/lib/ai-provider-metadata";

export type { AiProvider };
export { AI_PROVIDER_LABELS, AI_PROVIDER_VALUES, SUPPORTED_MODELS };

export interface AiModelConfig {
  provider: AiProvider;
  model: string;
  /** Server-side only. Custom provider keys are stored in ai_config_secrets. */
  apiKey?: string;
  /** Server-side only. Required for custom OpenAI-compatible providers. */
  baseUrl?: string;
  /** Metadata only. True when a server-side custom provider key exists. */
  apiKeyConfigured?: boolean;
}

const PROVIDER_KEY_ENV: Partial<Record<AiProvider, string>> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_AI_API_KEY",
  kimi: "KIMI_API_KEY",
  glm: "GLM_API_KEY",
};

export function getProviderApiKeyEnv(provider: AiProvider): string | undefined {
  return PROVIDER_KEY_ENV[provider];
}

function getDefaultConfig(): AiModelConfig {
  const provider = isAiProvider(process.env.AI_DEFAULT_PROVIDER)
    ? process.env.AI_DEFAULT_PROVIDER
    : DEFAULT_PROVIDER;
  const envModel = process.env.AI_DEFAULT_MODEL;
  const models = SUPPORTED_MODELS[provider];
  const model = envModel && (provider === "custom" || models.includes(envModel))
    ? envModel
    : provider === DEFAULT_PROVIDER
      ? DEFAULT_MODEL
      : models[0];

  return { provider, model };
}

export const DEFAULT_CONFIG: AiModelConfig = getDefaultConfig();

async function withCredentials(config: AiModelConfig, uid?: string): Promise<AiModelConfig> {
  if (config.provider === "custom") {
    if (!config.baseUrl?.trim()) {
      throw new Error("Custom AI provider requires baseUrl in users/{uid}.aiConfig.");
    }
    const storedApiKey = uid ? await getUserAiConfigApiKey(uid) : null;
    const legacyApiKey = process.env.TWD_AI_CONFIG_LEGACY_READ === "1"
      ? config.apiKey?.trim()
      : undefined;
    const apiKey = storedApiKey ?? legacyApiKey;

    if (!apiKey?.trim()) {
      throw new Error("Custom AI provider requires a server-side apiKey in ai_config_secrets.");
    }
    return { ...config, apiKey };
  }

  const envKey = PROVIDER_KEY_ENV[config.provider];
  const apiKey = envKey ? process.env[envKey] : undefined;
  if (!apiKey) {
    throw new Error(
      `AI provider "${config.provider}" is not configured. Set ${envKey} environment variable.`
    );
  }
  return { ...config, apiKey };
}

// ── Resolver ─────────────────────────────────────────────────────────────────

/**
 * Resolve the AI model config for a user.
 */
export async function resolveUserModel(uid: string): Promise<{
  config: AiModelConfig;
  apiKey: string;
  apiUrl?: string;
}> {
  let config = getDefaultConfig();

  try {
    const userDoc = await adminDb.collection("users").doc(uid).get();
    const userData = userDoc.data();
    if (userData?.aiConfig) {
      const userConfig = userData.aiConfig as AiModelConfig;
      if (isValidConfig(userConfig)) {
        config = userConfig;
      }
    }
  } catch (err) {
    console.error("[AI Model] Failed to read user config, using default:", err);
  }

  const configWithCredentials = await withCredentials(config, uid);
  return {
    config: configWithCredentials,
    apiKey: configWithCredentials.apiKey || "",
  };
}

/**
 * Resolve model for refresh. Uses the provider/model saved in aiRecipe when
 * available, otherwise falls back to the dashboard owner's config.
 */
export async function resolveRefreshModel(
  ownerUid: string,
  savedModel?: string,
  savedProvider?: string
): Promise<{
  config: AiModelConfig;
  apiKey: string;
  apiUrl?: string;
}> {
  if (savedModel) {
    const providerCandidates = isAiProvider(savedProvider)
      ? [savedProvider]
      : (Object.keys(SUPPORTED_MODELS) as AiProvider[]).filter((provider) =>
          provider === "custom" || SUPPORTED_MODELS[provider].includes(savedModel)
        );

    for (const provider of providerCandidates) {
      if (provider === "custom") continue;
      const envKey = PROVIDER_KEY_ENV[provider];
      const apiKey = envKey ? process.env[envKey] : undefined;
      if (apiKey) {
        return {
          config: { provider, model: savedModel, apiKey },
          apiKey,
        };
      }
    }
    console.warn(`[AI Model] Saved model "${savedModel}" not available, falling back to owner config`);
  }

  return resolveUserModel(ownerUid);
}

// ── Validation ───────────────────────────────────────────────────────────────

export function isValidConfig(config: unknown): config is AiModelConfig {
  if (!config || typeof config !== "object") return false;
  const c = config as Record<string, unknown>;
  if (!isAiProvider(c.provider)) return false;
  if (typeof c.model !== "string" || !c.model.trim()) return false;

  if (c.provider !== "custom" && !SUPPORTED_MODELS[c.provider].includes(c.model)) {
    return false;
  }

  if (c.apiKey !== undefined && typeof c.apiKey !== "string") return false;
  if (c.apiKeyConfigured !== undefined && typeof c.apiKeyConfigured !== "boolean") return false;
  if (c.baseUrl !== undefined && typeof c.baseUrl !== "string") return false;
  if (c.provider === "custom" && !c.baseUrl?.toString().trim()) return false;

  return true;
}

export function sanitizeAiConfig(config: AiModelConfig | null | undefined) {
  if (!config) return null;
  return {
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
    apiKeyConfigured: Boolean(config.apiKey || config.apiKeyConfigured),
  };
}

export function getSupportedModels(): Array<{ provider: AiProvider; model: string; label: string }> {
  const models: Array<{ provider: AiProvider; model: string; label: string }> = [];
  for (const [provider, modelList] of Object.entries(SUPPORTED_MODELS)) {
    for (const model of modelList) {
      const typedProvider = provider as AiProvider;
      models.push({
        provider: typedProvider,
        model,
        label: `${AI_PROVIDER_LABELS[typedProvider]} - ${model}`,
      });
    }
  }
  return models;
}
