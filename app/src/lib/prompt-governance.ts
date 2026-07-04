export type PromptKey =
  | "builder.platform_rules"
  | "builder.mcp_freshness"
  | "builder.dynamic_dashboard"
  | "builder.platform_playbook"
  | "builder.db_playbook"
  | "refresh.system"
  | "data_chat.system";

export type PromptConsumer = "Builder" | "Refresh" | "Data Chat";

export interface PromptGovernance {
  purpose: string;
  consumers: PromptConsumer[];
  sourceFiles: string[];
  composition: string[];
  dependencies: string[];
  impact: string;
  risks: string[];
  safeChanges: string[];
  dangerousChanges: string[];
  badges: string[];
}

export interface PromptGlobalVariable {
  name: string;
  token: `{{${string}}}`;
  label: string;
  description: string;
  resolvedIn: PromptConsumer[];
}

export const PROMPT_TIME_ZONE = "America/Sao_Paulo";

export const GLOBAL_PROMPT_VARIABLES: PromptGlobalVariable[] = [
  {
    name: "today",
    token: "{{today}}",
    label: "Today",
    description: "Current date in YYYY-MM-DD format in the product timezone.",
    resolvedIn: ["Builder", "Refresh", "Data Chat"],
  },
  {
    name: "currentDate",
    token: "{{currentDate}}",
    label: "Current date",
    description: "Explicit alias for {{today}} for English-language prompts.",
    resolvedIn: ["Builder", "Refresh", "Data Chat"],
  },
  {
    name: "currentDatetime",
    token: "{{currentDatetime}}",
    label: "Current datetime",
    description:
      "Current date and time in America/Sao_Paulo for time-sensitive instructions.",
    resolvedIn: ["Builder", "Refresh", "Data Chat"],
  },
];

const GLOBAL_VARIABLES_BY_NAME = new Map(
  GLOBAL_PROMPT_VARIABLES.map((variable) => [variable.name, variable])
);

const GLOBAL_VARIABLE_PATTERN = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

function getDateTimeParts(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: byType.get("year") ?? "0000",
    month: byType.get("month") ?? "00",
    day: byType.get("day") ?? "00",
    hour: byType.get("hour") ?? "00",
    minute: byType.get("minute") ?? "00",
    second: byType.get("second") ?? "00",
  };
}

export function getGlobalPromptVariableValues(options?: {
  now?: Date;
  timeZone?: string;
}): Record<string, string> {
  const timeZone = options?.timeZone ?? PROMPT_TIME_ZONE;
  const parts = getDateTimeParts(options?.now ?? new Date(), timeZone);
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return {
    today: date,
    currentDate: date,
    currentDatetime: `${date} ${parts.hour}:${parts.minute}:${parts.second} ${timeZone}`,
  };
}

export function findUnknownGlobalVariables(content: string): string[] {
  const seen = new Set<string>();
  const unknown: string[] = [];
  for (const match of content.matchAll(GLOBAL_VARIABLE_PATTERN)) {
    const name = match[1];
    const token = `{{${name}}}`;
    if (!GLOBAL_VARIABLES_BY_NAME.has(name) && !seen.has(token)) {
      seen.add(token);
      unknown.push(token);
    }
  }
  return unknown;
}

export function renderGlobalPromptVariables(
  content: string,
  options?: { now?: Date; timeZone?: string }
): { content: string; unknownVariables: string[] } {
  const values = getGlobalPromptVariableValues(options);
  const unknownVariables: string[] = [];
  const seenUnknown = new Set<string>();

  const rendered = content.replace(
    GLOBAL_VARIABLE_PATTERN,
    (match, name: string) => {
      if (Object.prototype.hasOwnProperty.call(values, name)) {
        return values[name];
      }
      const token = `{{${name}}}`;
      if (!seenUnknown.has(token)) {
        seenUnknown.add(token);
        unknownVariables.push(token);
      }
      return match;
    }
  );

  return { content: rendered, unknownVariables };
}

export const PROMPT_GOVERNANCE: Record<PromptKey, PromptGovernance> = {
  "builder.platform_rules": {
    purpose:
      "Defines the technical rules the AI Dashboard Builder must follow when generating HTML, Chart.js, and when calling save_dashboard_html.",
    consumers: ["Builder"],
    sourceFiles: [
      "app/src/lib/ai-prompt.ts",
      "app/src/app/api/ai/chat/route.ts",
    ],
    composition: [
      "First layer of buildSystemPrompt().",
      "Comes before freshness, dynamism, platform playbook, MCP sources, and database.",
    ],
    dependencies: ["save_dashboard_html", "Chart.js v4", "MCP tools"],
    impact:
      "Affects new generations and edits made by the Builder. Does not change already-saved dashboards until they are edited/regenerated.",
    risks: [
      "Removing the save_dashboard_html requirement can end conversations without a saved dashboard.",
      "Relaxing HTML/Chart.js rules can produce broken dashboards in the viewer.",
    ],
    safeChanges: [
      "Adjust technical visual conventions without changing the save contract.",
      "Add responsiveness or accessibility constraints.",
    ],
    dangerousChanges: [
      "Allow arbitrary external libraries.",
      "Remove the requirement for real data or complete HTML.",
    ],
    badges: ["Used in Builder", "Affects future dashboards"],
  },
  "builder.mcp_freshness": {
    purpose:
      "Explains that MCP is a live source and that new calls should be treated as the most recent data available.",
    consumers: ["Builder", "Refresh", "Data Chat"],
    sourceFiles: [
      "app/src/lib/ai-prompt.ts",
      "app/src/lib/dashboard-refresh-worker.ts",
      "app/src/lib/data-chat-prompt-fallback.ts",
    ],
    composition: [
      "Second layer of the Builder.",
      "Injected into the Refresh template as ${mcpFreshness}.",
      "Injected into the Data Chat template as ${mcpFreshness}.",
    ],
    dependencies: ["builder.platform_rules", "refresh.system", "data_chat.system"],
    impact:
      "Affects Builder, manual refresh, and Data Chat. Changes here propagate to multiple flows that query MCP.",
    risks: [
      "Weakening the contract can make the model reuse stale numbers.",
      "Removing timestamps reduces traceability of generated dashboards.",
    ],
    safeChanges: [
      "Clarify when to re-query MCP for requests about today, now, or latest.",
      "Improve timestamp guidance without contradicting server-side refresh.",
    ],
    dangerousChanges: [
      "State that data in the current HTML is the source of truth.",
      "Instruct the model to reuse old results for current data.",
    ],
    badges: ["Shared", "Used in Builder", "Used in Refresh", "Used in Data Chat"],
  },
  "builder.dynamic_dashboard": {
    purpose:
      "Aligns the Builder's response about HTML snapshot versus server-side refresh for the Talk With Data platform.",
    consumers: ["Builder"],
    sourceFiles: [
      "app/src/lib/ai-prompt.ts",
      "app/src/app/api/ai/chat/route.ts",
    ],
    composition: [
      "Third layer of buildSystemPrompt().",
      "Comes after the MCP contract and before the institutional playbook.",
    ],
    dependencies: ["builder.mcp_freshness", "dashboard refresh route"],
    impact:
      "Affects how new MCP-backed dashboards are conceived and described by the model.",
    risks: [
      "The model can promise live browser updates that the platform does not provide.",
      "The model can deny dynamism even when server-side refresh is available.",
    ],
    safeChanges: [
      "Refine language about snapshot, manual refresh, and roadmap.",
      "Add layout examples prepared for periodic refresh.",
    ],
    dangerousChanges: [
      "Promise scheduled auto-refresh if it is not yet implemented.",
      "Ask for MCP calls directly from the browser.",
    ],
    badges: ["Used in Builder", "Affects dynamism narrative"],
  },
  "builder.platform_playbook": {
    purpose:
      "Provides institutional context, visual identity, and minimum dashboard standards for Talk With Data.",
    consumers: ["Builder"],
    sourceFiles: [
      "app/src/lib/ai-prompt.ts",
      "app/src/app/api/ai/chat/route.ts",
    ],
    composition: [
      "Fourth layer of buildSystemPrompt().",
      "Comes before the dynamic list of MCP sources.",
    ],
    dependencies: ["brand colors", "dashboard standards"],
    impact:
      "Affects visual consistency and tone of dashboards generated or edited by the Builder.",
    risks: [
      "Brand changes can produce dashboards misaligned with the product.",
      "Removing empty states can worsen readability when MCP returns no data.",
    ],
    safeChanges: [
      "Update brand-approved visual standards.",
      "Refine empty state and timestamp requirements.",
    ],
    dangerousChanges: [
      "Change official colors without approval.",
      "Remove audience context and self-explanation.",
    ],
    badges: ["Used in Builder", "Affects visual standard"],
  },
  "builder.db_playbook": {
    purpose:
      "Defines when the Builder should use a per-dashboard database and which security/persistence limits to respect.",
    consumers: ["Builder"],
    sourceFiles: [
      "app/src/lib/ai-prompt.ts",
      "app/src/app/api/ai/chat/route.ts",
      "app/src/lib/app-db/tools.ts",
    ],
    composition: [
      "Optional layer of buildSystemPrompt().",
      "Only included when the draft dashboard has the database enabled.",
      "Can be followed by the current state of the dashboard's tables.",
    ],
    dependencies: ["App DB tools", "draftDashboardId", "database registry"],
    impact:
      "Affects only the Builder in apps with the database enabled, especially schema, persistence, and isolation.",
    risks: [
      "Duplicating MCP data in the database can create a divergent source.",
      "Allowing credentials or raw SQL breaks the App DB security boundary.",
    ],
    safeChanges: [
      "Add examples of persistent entities created by the user.",
      "Improve preview versus live mode rules.",
    ],
    dangerousChanges: [
      "Allow access to another dashboard's tables.",
      "Remove the rule to use structured tools instead of raw SQL.",
    ],
    badges: ["Builder with database", "Affects persistent apps"],
  },
  "refresh.system": {
    purpose:
      "Complete template used by the refresh worker to regenerate HTML with current data while preserving layout.",
    consumers: ["Refresh"],
    sourceFiles: [
      "app/src/lib/dashboard-refresh-worker.ts",
      "app/src/lib/refresh-prompt-fallback.ts",
    ],
    composition: [
      "Resolved by the registry as a template.",
      "Receives ${mcpFreshness}, ${title}, ${description}, ${currentHtmlBlock}, and ${refreshedAt}.",
      "Afterward the worker sends the prompt to the model with MCP tools and save_dashboard_html.",
    ],
    dependencies: ["builder.mcp_freshness", "aiRecipe.generationPrompt", "saved MCP server refs"],
    impact:
      "Affects future manual refreshes of AI dashboards that have a saved prompt and MCP references.",
    risks: [
      "Removing required placeholders breaks the refresh context.",
      "Asking for a from-scratch recreation can lose the current layout or structure.",
    ],
    safeChanges: [
      "Improve the layout-preservation instruction.",
      "Refine the refresh timestamp format.",
    ],
    dangerousChanges: [
      "Remove ${currentHtmlBlock} or ${mcpFreshness}.",
      "Instruct the model to ignore the current dashboard.",
    ],
    badges: ["Template", "Used in Refresh", "Affects manual refresh"],
  },
  "data_chat.system": {
    purpose:
      "Complete Data Chat template for analytical answers and dashboard creation only when the user asks for it.",
    consumers: ["Data Chat"],
    sourceFiles: [
      "app/src/app/api/ai/data-chat/route.ts",
      "app/src/lib/data-chat-prompt-fallback.ts",
    ],
    composition: [
      "Resolved by the registry as a template.",
      "Receives ${mcpFreshness}.",
      "Afterward receives the dynamic list of available MCP sources.",
    ],
    dependencies: ["builder.mcp_freshness", "MCP server selection"],
    impact:
      "Affects future conversations in Data Chat and how the agent answers versus creates dashboards.",
    risks: [
      "Removing the rule against inventing numbers harms reliability.",
      "Encouraging dashboard creation without an explicit request changes chat behavior.",
    ],
    safeChanges: [
      "Refine the analytical response format.",
      "Improve guidance on tables, timestamps, and conciseness.",
    ],
    dangerousChanges: [
      "Instruct it to create dashboards in every response.",
      "Remove ${mcpFreshness}.",
    ],
    badges: ["Template", "Used in Data Chat"],
  },
};
