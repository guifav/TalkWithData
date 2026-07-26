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
 * Escapa o nome da fonte antes de inseri-lo no system prompt. Usa allow-list
 * (so alfanumericos, espaco, hifem, underscore e ponto sao mantidos); tudo o
 * mais e removido. Isso bloqueia backticks, quebras de linha, markdown
 * (* # [ ] >), caracteres de template ($, { }) e tags de XML/HTML (< >)
 * que um admin malicioso poderia usar para injetar instrucoes. O
 * dataSourceId e o sql do usuario nunca sao passados por aqui; trata-se
 * apenas do rotulo legivel exibido ao modelo.
 */
export function escapeDataSourceName(name: string, maxLen = 80): string {
  const cleaned = name.replace(/[^a-zA-Z0-9 _.\-]/g, "").replace(/\s+/g, " ").trim();
  return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen - 3)}...` : cleaned;
}

export function escapeDataSourceId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_.\-]/g, "");
}

/**
 * Escapa nomes de coluna antes do prompt. Os safeNames do engine ja sao
 * [a-z0-9_], mas headers de CSV sao controlaveis pelo dono do bucket, entao
 * aplicamos a mesma allow-list defensiva (identificadores apenas).
 */
export function escapeColumnName(name: string, maxLen = 64): string {
  const cleaned = name.replace(/[^a-zA-Z0-9_]/g, "");
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) : cleaned;
}

export interface DataSourceSchemaInfo {
  columns: { name: string; type: string }[];
  rowCount: number;
}

/**
 * Prompt do dataset-chat (TalkWithData). SEPARADO do buildDataChatSystemPrompt
 * original (MCP) para nao quebrar o chat existente: reusa o base + mcp_freshness
 * e anexa a secao de Data Sources locais.
 *
 * A ownerColumn NUNCA entra no prompt (vazamento de escopo de linha) — o
 * schema cacheado do engine ja exclui a coluna de escopo com a mesma regra da
 * view filtrada. Fontes sem schema cacheado caem no fluxo de descoberta via
 * query_dataset (o retorno traz `columns`).
 */
export async function buildDatasetChatSystemPrompt(
  servers: DatasetChatServerInfo[],
  dataSources: DataSourceMetadata[],
  schemas?: Map<string, DataSourceSchemaInfo>,
): Promise<BuiltDataChatPrompt> {
  const built = await buildDataChatSystemPrompt(servers);

  const sourcesBlock = dataSources.length
    ? dataSources
        .map((ds) => {
          const header = `- **${escapeDataSourceName(ds.name ?? ds.id)}** (dataSourceId: \`${escapeDataSourceId(ds.id)}\`)`;
          const schema = schemas?.get(ds.id);
          if (!schema || schema.columns.length === 0) return header;
          const columnList = schema.columns
            .map((column) => ({
              name: escapeColumnName(column.name),
              type: escapeColumnName(column.type),
            }))
            .filter((column) => column.name.length > 0)
            .map((column) => `${column.name} (${column.type})`)
            .join(", ");
          if (!columnList) return header;
          return `${header}\n  - columns: ${columnList}\n  - approx. row count: ${Math.max(0, Math.floor(schema.rowCount))}`;
        })
        .join("\n")
    : "(nenhuma fonte de dados disponivel para este usuario)";

  const datasetSection = `
## Available Data Sources (TalkWithData)
Use the \`query_dataset\` tool to query the user's data sources.
- Params: \`dataSourceId\` (one of the ids below) and \`query\` (a SELECT-only SQL string).
- The server enforces row-level access: you only ever receive rows the viewer is allowed to see. Never assume you can see other rows.
- Sources listed with a \`columns:\` line already show their full schema. Do NOT run discovery queries (like 'SELECT * FROM view LIMIT 1') for those sources; query them directly using the listed columns.
- Only for sources WITHOUT a \`columns:\` line, learn the columns with a small query first, e.g. 'SELECT * FROM view LIMIT 1'. The tool result includes the column names.
- When you need several independent queries (different sources or unrelated aggregations), emit them as MULTIPLE query_dataset tool_use blocks in a SINGLE turn; they execute in parallel. Do not spread independent queries across turns.
- In your SQL, refer to the data source table as 'view' (the server rewrites it to the filtered view for the viewer). Example: 'SELECT region, SUM(amount) FROM view GROUP BY region'.
- Do NOT invent column names. Use the listed schema or derive them from query results.
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
