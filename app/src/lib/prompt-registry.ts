/**
 * Prompt Registry — resolves active prompt content for each known key.
 *
 * Priority:
 *   1. Active version stored in Firestore (`app_prompts/{key}` + `versions` subcollection)
 *   2. Hardcoded fallback from `lib/ai-prompt.ts` (or worker for `refresh.system`)
 *
 * The registry caches resolved prompts in-memory with a short TTL so that
 * chat / refresh requests do not hammer Firestore on every call. The cache
 * is process-local and best-effort — published edits propagate within
 * `CACHE_TTL_MS` worst-case.
 *
 * Issue #164
 */
import { adminDb } from "@/lib/firebase/admin";
import {
  PLATFORM_RULES,
  MCP_FRESHNESS,
  DYNAMIC_DASHBOARD,
  PLATFORM_PLAYBOOK,
  DB_PLAYBOOK,
} from "@/lib/ai-prompt";
import { REFRESH_SYSTEM_FALLBACK } from "@/lib/refresh-prompt-fallback";
import { DATA_CHAT_SYSTEM_FALLBACK } from "@/lib/data-chat-prompt-fallback";
import {
  GLOBAL_PROMPT_VARIABLES,
  PROMPT_GOVERNANCE,
  findUnknownGlobalVariables,
  renderGlobalPromptVariables,
  type PromptGlobalVariable,
  type PromptGovernance,
  type PromptKey,
} from "@/lib/prompt-governance";

export type { PromptGlobalVariable, PromptGovernance, PromptKey };

export interface PromptCatalogEntry {
  key: PromptKey;
  label: string;
  description: string;
  fallback: string;
  governance: PromptGovernance;
  globalVariables: PromptGlobalVariable[];
  /**
   * If true, the prompt is a template that contains placeholders. The
   * caller substitutes placeholders after loading the active content.
   */
  isTemplate?: boolean;
  /**
   * Placeholder names (without the `${}` wrapper) that must appear in
   * the content for the template to be valid. Enforced at publish time.
   */
  requiredPlaceholders?: string[];
}

export const PROMPT_CATALOG: PromptCatalogEntry[] = [
  {
    key: "builder.platform_rules",
    label: "Builder — Platform rules",
    description:
      "Technical constraints for HTML/Chart.js generation and the save_dashboard_html contract.",
    fallback: PLATFORM_RULES,
    governance: PROMPT_GOVERNANCE["builder.platform_rules"],
    globalVariables: GLOBAL_PROMPT_VARIABLES,
  },
  {
    key: "builder.mcp_freshness",
    label: "Builder — MCP freshness",
    description: "MCP data freshness contract. Shared with refresh worker.",
    fallback: MCP_FRESHNESS,
    governance: PROMPT_GOVERNANCE["builder.mcp_freshness"],
    globalVariables: GLOBAL_PROMPT_VARIABLES,
  },
  {
    key: "builder.dynamic_dashboard",
    label: "Builder — Dynamic dashboard",
    description:
      "Clarifies snapshot vs server-side refresh capabilities to the model.",
    fallback: DYNAMIC_DASHBOARD,
    governance: PROMPT_GOVERNANCE["builder.dynamic_dashboard"],
    globalVariables: GLOBAL_PROMPT_VARIABLES,
  },
  {
    key: "builder.platform_playbook",
    label: "Builder — Platform playbook",
    description: "Institutional context, brand colors, dashboard standards.",
    fallback: PLATFORM_PLAYBOOK,
    governance: PROMPT_GOVERNANCE["builder.platform_playbook"],
    globalVariables: GLOBAL_PROMPT_VARIABLES,
  },
  {
    key: "builder.db_playbook",
    label: "Builder — Database playbook",
    description: "Rules for apps with per-dashboard database persistence.",
    fallback: DB_PLAYBOOK,
    governance: PROMPT_GOVERNANCE["builder.db_playbook"],
    globalVariables: GLOBAL_PROMPT_VARIABLES,
  },
  {
    key: "refresh.system",
    label: "Refresh — System prompt",
    description:
      "System prompt used by the dashboard refresh worker. Supports placeholders ${mcpFreshness}, ${title}, ${description}, ${currentHtmlBlock}, ${refreshedAt}.",
    fallback: REFRESH_SYSTEM_FALLBACK,
    governance: PROMPT_GOVERNANCE["refresh.system"],
    globalVariables: GLOBAL_PROMPT_VARIABLES,
    isTemplate: true,
    requiredPlaceholders: [
      "mcpFreshness",
      "title",
      "description",
      "currentHtmlBlock",
      "refreshedAt",
    ],
  },
  {
    key: "data_chat.system",
    label: "Data chat — System prompt",
    description:
      "System prompt for the data analyst chat (/chat). Supports placeholder ${mcpFreshness} (substituted from builder.mcp_freshness at runtime).",
    fallback: DATA_CHAT_SYSTEM_FALLBACK,
    governance: PROMPT_GOVERNANCE["data_chat.system"],
    globalVariables: GLOBAL_PROMPT_VARIABLES,
    isTemplate: true,
    requiredPlaceholders: ["mcpFreshness"],
  },
];

const CATALOG_BY_KEY = new Map(PROMPT_CATALOG.map((e) => [e.key, e]));

export function isKnownPromptKey(key: string): key is PromptKey {
  return CATALOG_BY_KEY.has(key as PromptKey);
}

export function getCatalogEntry(key: PromptKey): PromptCatalogEntry {
  const entry = CATALOG_BY_KEY.get(key);
  if (!entry) throw new Error(`Unknown prompt key: ${key}`);
  return entry;
}

/**
 * Returns the list of required placeholders missing from `content`,
 * or [] if all required placeholders are present (or the prompt has none).
 *
 * Placeholders use the `${name}` literal syntax in the stored content.
 */
export function findMissingPlaceholders(
  key: PromptKey,
  content: string
): string[] {
  const entry = getCatalogEntry(key);
  if (!entry.requiredPlaceholders?.length) return [];
  return entry.requiredPlaceholders.filter(
    (name) => !content.includes(`\${${name}}`)
  );
}

export function validatePromptContent(
  key: PromptKey,
  content: string
): { missingPlaceholders: string[]; unknownVariables: string[] } {
  return {
    missingPlaceholders: findMissingPlaceholders(key, content),
    unknownVariables: findUnknownGlobalVariables(content),
  };
}

// ── Cache ────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  rawContent: string;
  version: number | null;
  fetchedAt: number;
}

const cache = new Map<PromptKey, CacheEntry>();

export function invalidatePromptCache(key?: PromptKey): void {
  if (key) cache.delete(key);
  else cache.clear();
}

// ── Resolver ─────────────────────────────────────────────────────────────────

export interface ResolvedPrompt {
  key: PromptKey;
  content: string;
  /** null when fallback (hardcoded) is used. */
  version: number | null;
  source: "firestore" | "fallback";
}

type FallbackReason = "doc_missing" | "doc_malformed" | "firestore_error";

async function readActiveFromFirestore(
  key: PromptKey
): Promise<
  { ok: true; content: string; version: number } | { ok: false; reason: FallbackReason }
> {
  try {
    const doc = await adminDb.collection("app_prompts").doc(key).get();
    if (!doc.exists) return { ok: false, reason: "doc_missing" };
    const data = doc.data();
    if (!data) return { ok: false, reason: "doc_missing" };
    const activeVersion = data.activeVersion;
    const activeContent = data.activeContent;
    if (
      typeof activeVersion !== "number" ||
      typeof activeContent !== "string" ||
      activeContent.length === 0
    ) {
      // Active fields missing/empty even though doc exists — this only
      // happens before the first publish, or if the doc was corrupted.
      const everPublished = typeof activeVersion === "number";
      return {
        ok: false,
        reason: everPublished ? "doc_malformed" : "doc_missing",
      };
    }
    return { ok: true, content: activeContent, version: activeVersion };
  } catch (err) {
    console.error(
      `[Prompt] Firestore read failed for key=${key}; using fallback. Error:`,
      err instanceof Error ? err.message : err
    );
    return { ok: false, reason: "firestore_error" };
  }
}

function renderRuntimeVariables(
  key: PromptKey,
  content: string,
  version: number | null
): ResolvedPrompt {
  const rendered = renderGlobalPromptVariables(content);
  if (rendered.unknownVariables.length === 0) {
    return {
      key,
      content: rendered.content,
      version,
      source: version === null ? "fallback" : "firestore",
    };
  }

  const versionLabel = version === null ? "fallback" : `v${version}`;
  console.error(
    `[Prompt] unknown_global_variables key=${key} version=${versionLabel} variables=${rendered.unknownVariables.join(", ")}`
  );

  if (version === null) {
    throw new Error(
      `Fallback prompt ${key} contains unknown global variables: ${rendered.unknownVariables.join(", ")}`
    );
  }

  const fallback = getCatalogEntry(key).fallback;
  const renderedFallback = renderGlobalPromptVariables(fallback);
  if (renderedFallback.unknownVariables.length > 0) {
    throw new Error(
      `Fallback prompt ${key} contains unknown global variables: ${renderedFallback.unknownVariables.join(", ")}`
    );
  }
  return {
    key,
    content: renderedFallback.content,
    version: null,
    source: "fallback",
  };
}

export async function resolvePrompt(key: PromptKey): Promise<ResolvedPrompt> {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return renderRuntimeVariables(key, cached.rawContent, cached.version);
  }

  const entry = getCatalogEntry(key);
  const active = await readActiveFromFirestore(key);
  if (active.ok) {
    cache.set(key, {
      rawContent: active.content,
      version: active.version,
      fetchedAt: now,
    });
    return renderRuntimeVariables(key, active.content, active.version);
  }

  // Fallback path — cache so we don't hammer Firestore when no version exists
  // yet. Note: cache is process-local; on multi-instance Cloud Run, edits
  // propagate within CACHE_TTL_MS to other instances.
  // Use warn for "doc_malformed" (real defect) and info for the expected
  // "doc_missing" pre-first-publish case. firestore_error already logged at
  // .error level inside readActiveFromFirestore.
  if (active.reason === "doc_malformed") {
    console.warn(
      `[Prompt] key=${key} doc exists but activeContent invalid; using fallback`
    );
  } else if (active.reason === "doc_missing") {
    console.info(
      `[Prompt] key=${key} has no published version; using fallback`
    );
  }
  cache.set(key, { rawContent: entry.fallback, version: null, fetchedAt: now });
  return renderRuntimeVariables(key, entry.fallback, null);
}

export async function resolveManyPrompts(
  keys: PromptKey[]
): Promise<Record<PromptKey, ResolvedPrompt>> {
  const results = await Promise.all(keys.map((k) => resolvePrompt(k)));
  const out = {} as Record<PromptKey, ResolvedPrompt>;
  for (const r of results) out[r.key] = r;
  return out;
}
