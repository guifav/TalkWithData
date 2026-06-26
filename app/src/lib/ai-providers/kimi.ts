import { OpenAiAdapter } from "./openai";

export const kimiAdapter = new OpenAiAdapter(
  "kimi",
  "https://api.moonshot.ai/v1/chat/completions"
);
