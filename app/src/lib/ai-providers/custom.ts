import { OpenAiAdapter } from "./openai";
import type { AiAdapter, AiChatOptions, AiChatResult, AiMessage } from "./types";
import { AiProviderError } from "./types";
import type { AiModelConfig } from "@/lib/ai-model";

class CustomAdapter implements AiAdapter {
  async chat(messages: AiMessage[], config: AiModelConfig, options?: AiChatOptions): Promise<AiChatResult> {
    if (!config.baseUrl?.trim()) {
      throw new AiProviderError("Custom AI provider requires a baseUrl.", {
        provider: "custom",
        type: "missing_base_url",
      });
    }
    if (!config.apiKey?.trim()) {
      throw new AiProviderError("Custom AI provider requires an apiKey.", {
        provider: "custom",
        type: "missing_api_key",
      });
    }
    return new OpenAiAdapter("custom", config.baseUrl).chat(messages, config, options);
  }
}

export const customAdapter = new CustomAdapter();
