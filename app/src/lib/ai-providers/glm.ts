import { OpenAiAdapter } from "./openai";

export const glmAdapter = new OpenAiAdapter(
  "glm",
  "https://api.z.ai/api/paas/v4/chat/completions"
);
