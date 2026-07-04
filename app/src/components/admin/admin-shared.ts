import type { AiProvider } from "@/lib/ai-provider-metadata";

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---- Types ----

export interface Overview {
  dashboards: { total: number; active: number; archived: number };
  users: { total: number; active7d: number; active30d: number };
  views: { total: number; last7d: number; last30d: number };
  storage: { totalBytes: number };
  embedTokens: { active: number; expired: number };
}

export interface DashboardRow {
  id: string;
  title: string;
  category: string;
  ownerEmail: string;
  ownerName: string;
  viewCount: number;
  uniqueViewers: number;
  embedViews: number;
  fileSizeBytes: number;
  createdAt: string | null;
  updatedAt: string | null;
  archivedAt: string | null;
  source: "upload" | "ai";
  aiToolsUsed: string[];
  lastRefreshedAt: string | null;
}

export interface UserRow {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  department?: string;
  aiConfig?: {
    provider: AiProvider;
    model: string;
    baseUrl?: string;
    apiKeyConfigured?: boolean;
  } | null;
  dashboardsCreated: number;
  totalViewsGenerated: number;
  lastLoginAt: string | null;
}

export interface McpStatsSummary {
  aiDashboardCount: number;
  activeServerCount: number;
  totalServerCount: number;
}

export interface McpServerStat {
  mcpServerId: string;
  name: string;
  active: boolean;
  toolCount: number;
  dashboardCount: number;
  userCount: number;
  dashboards: Array<{ id: string; title: string; createdByEmail: string }>;
  assignedDepartments: string[];
  assignedUsers: string[];
}

export interface ViewsData {
  timeSeries: { date: string; direct: number; embed: number }[];
  topEmbedded: { id: string; title: string; count: number }[];
  embedTokens: {
    dashboardTitle: string;
    createdByEmail: string;
    createdAt: string | null;
    expiresAt: string | null;
    isActive: boolean;
  }[];
}

export interface StorageData {
  byUser: { uid: string; email: string; bytes: number; count: number }[];
  byCategory: { category: string; bytes: number }[];
  largeFiles: {
    id: string;
    title: string;
    ownerEmail: string;
    fileSizeBytes: number;
    fileName: string;
  }[];
  versions: { totalBytes: number; totalCount: number };
  totalBytes: number;
}
