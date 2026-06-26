/**
 * Fallback content for the data-chat system prompt (catalog key: data_chat.system).
 *
 * Kept in its own module so the prompt-registry catalog can import a
 * pure string without pulling in the data-chat route's server-only
 * dependencies (Firebase admin, MCP client).
 *
 * Placeholders:
 *  - ${mcpFreshness} → builder.mcp_freshness layer
 */
export const DATA_CHAT_SYSTEM_FALLBACK = `You are a data analyst for the GRI Institute. You help users explore and understand their data through conversation.

## Your role
- Answer questions about data in a clear, analytical way
- Use tables, bullet points, and summaries to present data
- Provide insights and observations, not just raw numbers
- When comparing data, highlight trends and anomalies

## Response format
- Use Markdown for formatting (tables, bold, lists, code blocks)
- For numerical data, use tables with clear headers
- Include data timestamps when relevant
- Be concise but thorough

## Dashboard creation
- Only generate an HTML dashboard when the user explicitly asks for it (e.g., "create a dashboard", "make this visual", "turn this into a dashboard")
- When creating a dashboard, follow these HTML rules:
  - Self-contained HTML with inline CSS/JS
  - Chart.js from CDN (https://cdn.jsdelivr.net/npm/chart.js) for charts
  - GRI brand colors: primary #1a1a2e, accent #e94560
  - Responsive design
- Call save_dashboard_html with the complete HTML

## Important
- Query real data, never make up numbers
- If a query returns no data, say so clearly
- Keep responses focused on the question asked
- Don't suggest creating a dashboard unless asked

\${mcpFreshness}`;

/**
 * Substitutes ${name} placeholders in a single pass so a value containing
 * another placeholder literal is NOT re-substituted on a subsequent pass.
 */
export function renderDataChatSystemPrompt(
  template: string,
  vars: { mcpFreshness: string }
): string {
  const lookup: Record<string, string> = vars;
  return template.replace(
    /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g,
    (match, name: string) => {
      if (Object.prototype.hasOwnProperty.call(lookup, name)) {
        return lookup[name];
      }
      return match;
    }
  );
}

export interface BuiltDataChatPrompt {
  prompt: string;
  /** Map of prompt key → resolved version (null when fallback was used). */
  promptVersions: Record<string, number | null>;
}

/**
 * Assembles the data-chat system prompt by resolving the
 * `data_chat.system` template and injecting the `builder.mcp_freshness`
 * layer, then appending a runtime-built data sources block.
 *
 * Each layer is resolved through the prompt registry (Firestore-backed
 * with a hardcoded fallback). The function also returns the resolved
 * versions so the caller can log which prompt revisions ran.
 */
export async function buildDataChatSystemPrompt(
  servers: Array<{
    name: string;
    description: string;
    tools: Array<{ name: string }>;
  }>
): Promise<BuiltDataChatPrompt> {
  const { resolveManyPrompts } = await import("@/lib/prompt-registry");
  const resolved = await resolveManyPrompts([
    "data_chat.system",
    "builder.mcp_freshness",
  ]);

  const dataSources = servers
    .map((s) => `- **${s.name}**: ${s.description} (${s.tools.length} tools)`)
    .join("\n");

  const base = renderDataChatSystemPrompt(resolved["data_chat.system"].content, {
    mcpFreshness: resolved["builder.mcp_freshness"].content,
  });

  return {
    prompt: `${base}\n\n## Available Data Sources\n${dataSources}`,
    promptVersions: {
      "data_chat.system": resolved["data_chat.system"].version,
      "builder.mcp_freshness": resolved["builder.mcp_freshness"].version,
    },
  };
}
