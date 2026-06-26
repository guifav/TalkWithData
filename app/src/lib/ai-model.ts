/**
 * AI Model Resolver — centralizes model selection for all AI routes.
 *
 * Replaces hardcoded `const MODEL = "claude-opus-4-20250514"` with
 * per-user configuration stored in Firestore users/{uid}.aiConfig.
 *
 * V1: Anthropic only. Google Gemini requires a separate request adapter
 * (different endpoint, auth header, payload format, response parsing).
 *
 * Issue #114
 */

import { adminDb } from "@/lib/firebase/admin";

// ── Supported providers and models ───────────────────────────────────────────

/**
 * V1 = Anthropic only. Adding a new provider requires implementing
 * the corresponding request adapter in the AI routes.
 */
export type AiProvider = "anthropic";

export interface AiModelConfig {
  provider: AiProvider;
  model: string;
}

export const SUPPORTED_MODELS: Record<AiProvider, string[]> = {
  anthropic: [
    "claude-opus-4-20250514",
    "claude-sonnet-4-20250514",
  ],
};

export const DEFAULT_CONFIG: AiModelConfig = {
  provider: "anthropic",
  model: "claude-opus-4-20250514",
};

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

const PROVIDER_KEY_ENV: Record<AiProvider, string> = {
  anthropic: "ANTHROPIC_API_KEY",
};

// ── Resolver ─────────────────────────────────────────────────────────────────

/**
 * Resolve the AI model config for a user.
 *
 * Priority:
 *   1. User's aiConfig in Firestore (set by superadmin)
 *   2. Default (claude-opus-4-20250514)
 *
 * Throws if the resolved provider's API key is not configured.
 */
export async function resolveUserModel(uid: string): Promise<{
  config: AiModelConfig;
  apiKey: string;
  apiUrl: string;
}> {
  let config = DEFAULT_CONFIG;

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

  const apiKey = process.env[PROVIDER_KEY_ENV[config.provider]];
  if (!apiKey) {
    throw new Error(
      `AI provider "${config.provider}" is not configured. ` +
      `Set ${PROVIDER_KEY_ENV[config.provider]} environment variable.`
    );
  }

  return {
    config,
    apiKey,
    apiUrl: ANTHROPIC_API_URL,
  };
}

/**
 * Resolve model for refresh — uses the model saved in aiRecipe if available,
 * otherwise falls back to the dashboard owner's config.
 */
export async function resolveRefreshModel(
  ownerUid: string,
  savedModel?: string
): Promise<{
  config: AiModelConfig;
  apiKey: string;
  apiUrl: string;
}> {
  if (savedModel) {
    for (const [provider, models] of Object.entries(SUPPORTED_MODELS)) {
      if (models.includes(savedModel)) {
        const envKey = PROVIDER_KEY_ENV[provider as AiProvider];
        const apiKey = process.env[envKey];
        if (apiKey) {
          return {
            config: { provider: provider as AiProvider, model: savedModel },
            apiKey,
            apiUrl: ANTHROPIC_API_URL,
          };
        }
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
  if (typeof c.provider !== "string" || typeof c.model !== "string") return false;
  const provider = c.provider as AiProvider;
  if (!SUPPORTED_MODELS[provider]) return false;
  return SUPPORTED_MODELS[provider].includes(c.model as string);
}

export function getSupportedModels(): Array<{ provider: AiProvider; model: string; label: string }> {
  const models: Array<{ provider: AiProvider; model: string; label: string }> = [];
  for (const [provider, modelList] of Object.entries(SUPPORTED_MODELS)) {
    for (const model of modelList) {
      models.push({
        provider: provider as AiProvider,
        model,
        label: `Anthropic — ${model}`,
      });
    }
  }
  return models;
}

// ── Anthropic request helpers ────────────────────────────────────────────────

export function buildAnthropicHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  };
}
