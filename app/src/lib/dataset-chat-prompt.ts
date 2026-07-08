import {
  buildDataChatSystemPrompt,
  type BuiltDataChatPrompt,
} from "@/lib/data-chat-prompt-fallback";
import type { DataSourceMetadata } from "@/lib/data-sources/firestore";

export interface DatasetChatServerInfo {
  name: string;
  description: string;
  tools: Array<{ name: string }>;
}

/**
 * Escapa o nome da fonte antes de inseri-lo no system prompt. Remove
 * backticks (que fechariam o code-span), quebras de linha (que permitiriam
 * injetar novas linhas de prompt) e trunca a um tamanho seguro. O dataSourceId
 * e o sql do usuario nunca sao passados por aqui; trata-se apenas do rotulo
 * legivel exibido ao modelo.
 */
function escapeDataSourceName(name: string, maxLen = 80): string {
  const cleaned = name
    .replace(/`/g, "'")
    .replace(/[\r\n\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > maxLen
    ? `${cleaned.slice(0, maxLen - 1)}…`
    : cleaned;
}

/**
 * Prompt do dataset-chat (TalkWithData). SEPARADO do buildDataChatSystemPrompt
 * original (MCP) para nao quebrar o chat existente: reusa o base + mcp_freshness
 * e anexa a secao de Data Sources locais.
 *
 * A ownerColumn NUNCA entra no prompt (vazamento de escopo de linha). O modelo
 * descobre as colunas via query_dataset (o retorno traz `columns`).
 */
export async function buildDatasetChatSystemPrompt(
  servers: DatasetChatServerInfo[],
  dataSources: DataSourceMetadata[],
): Promise<BuiltDataChatPrompt> {
  const built = await buildDataChatSystemPrompt(servers);

  const sourcesBlock = dataSources.length
    ? dataSources
        .map(
          (ds) =>
            `- **${escapeDataSourceName(ds.name ?? ds.id)}** (dataSourceId: \`${escapeDataSourceName(ds.id)}\`)`,
        )
        .join("\n")
    : "(nenhuma fonte de dados disponivel para este usuario)";

  const datasetSection = `
## Available Data Sources (TalkWithData)
Use the \`query_dataset\` tool to query the user's data sources.
- Params: \`dataSourceId\` (one of the ids below) and \`query\` (a SELECT-only SQL string).
- The server enforces row-level access: you only ever receive rows the viewer is allowed to see. Never assume you can see other rows.
- To learn the columns of a source, run a small query first, e.g. 'SELECT * FROM view LIMIT 1'. The tool result includes the column names.
- In your SQL, refer to the data source table as 'view' (the server rewrites it to the filtered view for the viewer). Example: 'SELECT region, SUM(amount) FROM view GROUP BY region'.
- Do NOT invent column names. Derive them from query results.
- Available sources:
${sourcesBlock}`;

  return {
    prompt: `${built.prompt}\n${datasetSection}`,
    promptVersions: built.promptVersions,
  };
}

export const QUERY_DATASET_TOOL = {
  name: "query_dataset",
  description:
    "Query a TalkWithData data source with a SELECT-only SQL string. Returns rows scoped to the viewer (row-level access enforced server-side). Use to explore and analyze the user's datasets.",
  input_schema: {
    type: "object" as const,
    properties: {
      dataSourceId: {
        type: "string",
        description: "The dataSourceId of the source to query (see Available Data Sources).",
      },
      query: {
        type: "string",
        description: "A SELECT-only SQL query. Only the filtered view is reachable; DDL/DML are blocked.",
      },
    },
    required: ["dataSourceId", "query"],
  },
};
