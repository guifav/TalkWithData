import type { AiAdapter } from "./types";
import type { AiProvider } from "@/lib/ai-model";
import { anthropicAdapter } from "./anthropic";
import { openAiAdapter } from "./openai";
import { googleAdapter } from "./google";
import { kimiAdapter } from "./kimi";
import { glmAdapter } from "./glm";
import { customAdapter } from "./custom";

const ADAPTERS: Record<AiProvider, AiAdapter> = {
  anthropic: anthropicAdapter,
  openai: openAiAdapter,
  google: googleAdapter,
  kimi: kimiAdapter,
  glm: glmAdapter,
  custom: customAdapter,
};

export function getAiAdapter(provider: AiProvider): AiAdapter {
  const adapter = ADAPTERS[provider];
  if (!adapter) {
    throw new Error(`Unsupported AI provider: ${provider}`);
  }
  return adapter;
}

export { AiProviderError } from "./types";
export type { AiAdapter, AiChatOptions, AiChatResult, AiContentBlock, AiMessage, AiTool } from "./types";
