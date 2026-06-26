export type PromptKey =
  | "builder.platform_rules"
  | "builder.mcp_freshness"
  | "builder.dynamic_dashboard"
  | "builder.gri_playbook"
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
    description: "Data atual em formato YYYY-MM-DD no timezone do produto.",
    resolvedIn: ["Builder", "Refresh", "Data Chat"],
  },
  {
    name: "currentDate",
    token: "{{currentDate}}",
    label: "Current date",
    description: "Alias explicito de {{today}} para prompts em ingles.",
    resolvedIn: ["Builder", "Refresh", "Data Chat"],
  },
  {
    name: "currentDatetime",
    token: "{{currentDatetime}}",
    label: "Current datetime",
    description:
      "Data e horario atuais em America/Sao_Paulo para instrucoes sensiveis a tempo.",
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
      "Define as regras tecnicas que o AI Dashboard Builder deve seguir ao gerar HTML, Chart.js e ao chamar save_dashboard_html.",
    consumers: ["Builder"],
    sourceFiles: [
      "app/src/lib/ai-prompt.ts",
      "app/src/app/api/ai/chat/route.ts",
    ],
    composition: [
      "Primeira camada do buildSystemPrompt().",
      "Vem antes de freshness, dinamismo, playbook internal, fontes MCP e database.",
    ],
    dependencies: ["save_dashboard_html", "Chart.js v4", "MCP tools"],
    impact:
      "Afeta novas geracoes e edicoes feitas pelo Builder. Nao altera dashboards ja salvos ate que sejam editados/regenerados.",
    risks: [
      "Remover a obrigatoriedade de save_dashboard_html pode encerrar conversas sem dashboard salvo.",
      "Relaxar regras de HTML/Chart.js pode gerar dashboards quebrados no viewer.",
    ],
    safeChanges: [
      "Ajustar convencoes visuais tecnicas sem mudar o contrato de salvamento.",
      "Adicionar restricoes de responsividade ou acessibilidade.",
    ],
    dangerousChanges: [
      "Permitir bibliotecas externas arbitrarias.",
      "Remover a exigencia de dados reais ou do HTML completo.",
    ],
    badges: ["Usado no Builder", "Afeta dashboards futuros"],
  },
  "builder.mcp_freshness": {
    purpose:
      "Explica que MCP e fonte viva e que chamadas novas devem ser tratadas como dado mais recente disponivel.",
    consumers: ["Builder", "Refresh", "Data Chat"],
    sourceFiles: [
      "app/src/lib/ai-prompt.ts",
      "app/src/lib/dashboard-refresh-worker.ts",
      "app/src/lib/data-chat-prompt-fallback.ts",
    ],
    composition: [
      "Segunda camada do Builder.",
      "Injetada no template de Refresh como ${mcpFreshness}.",
      "Injetada no template de Data Chat como ${mcpFreshness}.",
    ],
    dependencies: ["builder.platform_rules", "refresh.system", "data_chat.system"],
    impact:
      "Afeta Builder, refresh manual e Data Chat. Mudancas aqui propagam para multiplos fluxos que consultam MCP.",
    risks: [
      "Enfraquecer o contrato pode fazer o modelo reutilizar numeros antigos.",
      "Remover timestamps reduz rastreabilidade de dashboards gerados.",
    ],
    safeChanges: [
      "Clarificar quando reconsultar MCP para pedidos de hoje, agora ou latest.",
      "Melhorar orientacao de timestamp sem contradizer refresh server-side.",
    ],
    dangerousChanges: [
      "Dizer que dados do HTML atual sao fonte da verdade.",
      "Instruir o modelo a reaproveitar resultados antigos para dados atuais.",
    ],
    badges: ["Compartilhado", "Usado no Builder", "Usado no Refresh", "Usado no Data Chat"],
  },
  "builder.dynamic_dashboard": {
    purpose:
      "Alinha a resposta do Builder sobre snapshot HTML versus refresh server-side da plataforma Dashs.",
    consumers: ["Builder"],
    sourceFiles: [
      "app/src/lib/ai-prompt.ts",
      "app/src/app/api/ai/chat/route.ts",
    ],
    composition: [
      "Terceira camada do buildSystemPrompt().",
      "Fica depois do contrato MCP e antes do playbook institucional.",
    ],
    dependencies: ["builder.mcp_freshness", "dashboard refresh route"],
    impact:
      "Afeta como novos dashboards MCP-backed sao concebidos e descritos pelo modelo.",
    risks: [
      "O modelo pode prometer live browser updates que a plataforma nao fornece.",
      "O modelo pode negar dinamismo mesmo com refresh server-side disponivel.",
    ],
    safeChanges: [
      "Refinar linguagem sobre snapshot, refresh manual e roadmap.",
      "Adicionar exemplos de layout preparado para refresh periodico.",
    ],
    dangerousChanges: [
      "Prometer auto-refresh agendado se ainda nao estiver implementado.",
      "Pedir chamadas MCP diretamente do browser.",
    ],
    badges: ["Usado no Builder", "Afeta narrativa de dinamismo"],
  },
  "builder.gri_playbook": {
    purpose:
      "Fornece contexto institucional, identidade visual e padroes minimos de dashboards para o the project.",
    consumers: ["Builder"],
    sourceFiles: [
      "app/src/lib/ai-prompt.ts",
      "app/src/app/api/ai/chat/route.ts",
    ],
    composition: [
      "Quarta camada do buildSystemPrompt().",
      "Vem antes da lista dinamica de fontes MCP.",
    ],
    dependencies: ["brand colors", "dashboard standards"],
    impact:
      "Afeta consistencia visual e tom dos dashboards gerados ou editados pelo Builder.",
    risks: [
      "Mudancas de marca podem criar dashboards desalinhados com o produto.",
      "Remover estados vazios pode piorar leitura quando MCP retorna sem dados.",
    ],
    safeChanges: [
      "Atualizar padroes visuais aprovados pela marca.",
      "Refinar requisitos de empty state e timestamp.",
    ],
    dangerousChanges: [
      "Trocar cores oficiais sem aprovacao.",
      "Remover contexto de audiencia e autoexplicacao.",
    ],
    badges: ["Usado no Builder", "Afeta padrao visual"],
  },
  "builder.db_playbook": {
    purpose:
      "Define quando o Builder deve usar database por dashboard e quais limites de seguranca/persistencia respeitar.",
    consumers: ["Builder"],
    sourceFiles: [
      "app/src/lib/ai-prompt.ts",
      "app/src/app/api/ai/chat/route.ts",
      "app/src/lib/app-db/tools.ts",
    ],
    composition: [
      "Camada opcional do buildSystemPrompt().",
      "Entra somente quando o draft dashboard tem database habilitado.",
      "Pode ser seguida pelo estado atual das tabelas do dashboard.",
    ],
    dependencies: ["App DB tools", "draftDashboardId", "database registry"],
    impact:
      "Afeta apenas Builder em apps com banco habilitado, especialmente schema, persistencia e isolamento.",
    risks: [
      "Duplicar dados MCP no database pode criar fonte divergente.",
      "Permitir credenciais ou SQL cru quebra o limite de seguranca do App DB.",
    ],
    safeChanges: [
      "Adicionar exemplos de entidades persistentes criadas pelo usuario.",
      "Melhorar regras de preview versus live mode.",
    ],
    dangerousChanges: [
      "Permitir acesso a tabelas de outro dashboard.",
      "Remover a regra de usar ferramentas estruturadas em vez de SQL cru.",
    ],
    badges: ["Builder com banco", "Afeta apps persistentes"],
  },
  "refresh.system": {
    purpose:
      "Template completo usado pelo worker de refresh para regenerar HTML com dados atuais preservando layout.",
    consumers: ["Refresh"],
    sourceFiles: [
      "app/src/lib/dashboard-refresh-worker.ts",
      "app/src/lib/refresh-prompt-fallback.ts",
    ],
    composition: [
      "Resolvido pelo registry como template.",
      "Recebe ${mcpFreshness}, ${title}, ${description}, ${currentHtmlBlock} e ${refreshedAt}.",
      "Depois o worker envia o prompt ao modelo com ferramentas MCP e save_dashboard_html.",
    ],
    dependencies: ["builder.mcp_freshness", "aiRecipe.generationPrompt", "saved MCP server refs"],
    impact:
      "Afeta refreshes manuais futuros de dashboards AI que tenham prompt e referencias MCP salvas.",
    risks: [
      "Remover placeholders obrigatorios quebra contexto do refresh.",
      "Pedir recriacao do zero pode perder layout ou estrutura atual.",
    ],
    safeChanges: [
      "Melhorar instrucao de preservacao de layout.",
      "Refinar formato do timestamp de refresh.",
    ],
    dangerousChanges: [
      "Remover ${currentHtmlBlock} ou ${mcpFreshness}.",
      "Instruir o modelo a ignorar o dashboard atual.",
    ],
    badges: ["Template", "Usado no Refresh", "Afeta refresh manual"],
  },
  "data_chat.system": {
    purpose:
      "Template completo do Data Chat para respostas analiticas e criacao de dashboards somente quando o usuario pedir.",
    consumers: ["Data Chat"],
    sourceFiles: [
      "app/src/app/api/ai/data-chat/route.ts",
      "app/src/lib/data-chat-prompt-fallback.ts",
    ],
    composition: [
      "Resolvido pelo registry como template.",
      "Recebe ${mcpFreshness}.",
      "Depois recebe a lista dinamica de fontes MCP disponiveis.",
    ],
    dependencies: ["builder.mcp_freshness", "MCP server selection"],
    impact:
      "Afeta conversas futuras no Data Chat e como o agente responde versus cria dashboards.",
    risks: [
      "Remover a regra de nao inventar numeros prejudica confiabilidade.",
      "Incentivar dashboard sem pedido explicito muda o comportamento do chat.",
    ],
    safeChanges: [
      "Refinar formato de resposta analitica.",
      "Melhorar orientacao de tabelas, timestamps e concisao.",
    ],
    dangerousChanges: [
      "Mandar criar dashboards em toda resposta.",
      "Remover ${mcpFreshness}.",
    ],
    badges: ["Template", "Usado no Data Chat"],
  },
};
