export const AI_PROVIDER_VALUES = [
  "anthropic",
  "openai",
  "google",
  "kimi",
  "glm",
  "custom",
] as const;

export type AiProvider = (typeof AI_PROVIDER_VALUES)[number];

export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google Gemini",
  kimi: "Kimi (Moonshot)",
  glm: "GLM (Z.ai)",
  custom: "Custom",
};

export const SUPPORTED_MODELS: Record<AiProvider, string[]> = {
  anthropic: ["claude-opus-4-20250514", "claude-sonnet-4-20250514"],
  openai: ["gpt-4o", "gpt-4o-mini", "o3-mini", "gpt-4.1"],
  google: ["gemini-2.0-flash", "gemini-2.5-pro", "gemini-2.5-flash"],
  kimi: ["moonshot-v1-128k", "moonshot-v1-32k", "kimi-k2"],
  glm: ["glm-4-plus", "glm-4-flash", "glm-4-long"],
  custom: ["custom-model", "custom-model-large"],
};

export const DEFAULT_PROVIDER: AiProvider = "anthropic";
export const DEFAULT_MODEL = "claude-sonnet-4-20250514";

export function isAiProvider(value: unknown): value is AiProvider {
  return typeof value === "string" && AI_PROVIDER_VALUES.includes(value as AiProvider);
}
