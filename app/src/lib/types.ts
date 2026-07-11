import { Timestamp } from "firebase/firestore";

/** @deprecated Use useCategories() hook for dynamic categories. Kept as fallback. */
export const CATEGORIES = [
  "Finance",
  "Commercial",
  "CS",
  "Marketing",
  "Other",
] as const;

/** Category is now dynamic (stored in Firestore), so it's a plain string. */
export type DashboardCategory = string;

export interface AiRecipe {
  queries: Array<{ tool: string; args: Record<string, unknown>; mcpServerId?: string }>;
  generationPrompt: string;
  lastRefreshedAt: string;
  refreshSchedule: "daily" | "weekly" | "manual";
  staleAfterHours: number;
  /** AI model used to generate/refresh this dashboard (e.g. "claude-opus-4-20250514") */
  model?: string;
  /** AI provider used (e.g. "anthropic", "openai") */
  provider?: string;
  /** Files uploaded and used during generation */
  uploads?: Array<{ name: string; type: string; parsedChars: number }>;
}

export interface Dashboard {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: DashboardCategory;
  fileName: string;
  storagePath: string;
  fileSizeBytes: number;
  thumbnailUrl?: string | null;
  thumbnailUpdatedAt?: string | null;
  thumbnailStoragePath?: string | null;
  thumbnailContentType?: string | null;
  visibility: "team" | "specific";
  allowedEmails: string[];
  allowedDepartments?: string[];
  createdBy: string;
  createdByEmail: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  viewCount: number;
  lastViewedAt: Timestamp | null;
  archivedAt: Timestamp | null;
  archivedBy: string | null;
  source?: "upload" | "ai";
  aiRecipe?: AiRecipe;
  /** Multi-page dashboard fields (ZIP upload) */
  isMultiPage?: boolean;
  /** Active package prefix. Legacy dashboards fall back to the stable dashboard prefix. */
  storagePrefix?: string;
  /** Entry point file relative to the storage prefix (defaults to "index.html") */
  entrypoint?: string;
  /** List of all files in the package (relative paths) */
  files?: string[];
}

export interface FavoriteDoc {
  dashboardId: string;
  favoritedAt: Timestamp;
}

export interface McpServer {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  requiredScope: string;
  tools: Array<{ name: string; description: string; inputSchema?: Record<string, unknown> }>;
  toolCount: number;
  lastSyncedAt: string | null;
  lastSyncError?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecentDoc {
  dashboardId: string;
  viewedAt: Timestamp;
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  department?: string;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  memberUids: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
