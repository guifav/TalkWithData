"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/hooks/use-role";
import { useAuth } from "@/hooks/use-auth";
import { authFetch } from "@/lib/firebase/auth";
import { AppShell } from "@/components/layout/app-shell";
import { AdminSkeleton } from "@/components/skeletons/admin-skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LayoutDashboard,
  Users,
  Eye,
  HardDrive,
  TrendingUp,
  Code,
  FileText,
  Activity,
  Pencil,
  Trash2,
  Plus,
  Check,
  X,
  Shield,
  Building2,
  Server,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { McpServersTab } from "@/components/admin/mcp-servers-tab";
import { McpAccessTab } from "@/components/admin/mcp-access-tab";
import type { Department } from "@/lib/types";
import { DepartmentsTab } from "@/components/admin/departments-tab";
import { PromptsTab } from "@/components/admin/prompts-tab";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---- Types ----

interface Overview {
  dashboards: { total: number; active: number; archived: number };
  users: { total: number; active7d: number; active30d: number };
  views: { total: number; last7d: number; last30d: number };
  storage: { totalBytes: number };
  embedTokens: { active: number; expired: number };
}

interface DashboardRow {
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

interface UserRow {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  department?: string;
  dashboardsCreated: number;
  totalViewsGenerated: number;
  lastLoginAt: string | null;
}

interface McpStatsSummary {
  aiDashboardCount: number;
  activeServerCount: number;
  totalServerCount: number;
}

interface McpServerStat {
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

interface ViewsData {
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

interface StorageData {
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

// ---- Stat Card ----

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Departments Panel ----

function DepartmentsPanel({
  departments,
  deptCounts,
  onUpdate,
}: {
  departments: string[];
  deptCounts: Record<string, number>;
  onUpdate: (updated: string[]) => void;
}) {
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const res = await authFetch("/api/admin/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", name }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }
      const data = await res.json();
      onUpdate(data.categories);
      setNewName("");
      toast.success(`Added "${name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async (oldName: string) => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === oldName) {
      setEditingName(null);
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch("/api/admin/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rename", name: oldName, newName: trimmed }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }
      const data = await res.json();
      onUpdate(data.categories);
      setEditingName(null);
      toast.success(`Renamed to "${trimmed}" (${data.dashboardsUpdated} dashboards updated)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rename");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (name: string) => {
    const count = deptCounts[name] || 0;
    const msg = count > 0
      ? `Remove "${name}"? ${count} dashboard${count > 1 ? "s" : ""} will be reclassified to "Other".`
      : `Remove "${name}"?`;
    if (!confirm(msg)) return;

    setSaving(true);
    try {
      const res = await authFetch("/api/admin/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", name }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }
      const data = await res.json();
      onUpdate(data.categories);
      toast.success(
        data.dashboardsReclassified > 0
          ? `Removed "${name}" (${data.dashboardsReclassified} dashboards → Other)`
          : `Removed "${name}"`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Department Management</CardTitle>
        <CardDescription>
          Add, rename, or remove dashboard categories. &quot;Other&quot; is protected and cannot be modified.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border rounded-lg divide-y">
          {departments.map((dept) => {
            const isProtected = dept === "Other";
            const isEditing = editingName === dept;
            const count = deptCounts[dept] || 0;

            return (
              <div
                key={dept}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/50"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename(dept);
                          if (e.key === "Escape") setEditingName(null);
                        }}
                        className="h-8 max-w-[200px]"
                        autoFocus
                        disabled={saving}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleRename(dept)}
                        disabled={saving}
                      >
                        <Check className="size-4 text-green-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setEditingName(null)}
                        disabled={saving}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium">{dept}</span>
                      {isProtected && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                          <Shield className="size-3" />
                          protected
                        </span>
                      )}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {count} dashboard{count !== 1 ? "s" : ""}
                  </span>
                  {!isProtected && !isEditing && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditingName(dept);
                          setEditValue(dept);
                        }}
                        disabled={saving}
                        title="Rename"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleRemove(dept)}
                        disabled={saving}
                        title="Remove"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add new department */}
        <div className="flex items-center gap-2">
          <Input
            placeholder="New department name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            className="max-w-[250px]"
            disabled={saving}
          />
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={saving || !newName.trim()}
          >
            <Plus className="size-4 mr-1" />
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Main ----

export default function AdminPage() {
  const router = useRouter();
  const { loading: authLoading } = useAuth();
  const { isSuperAdmin, isAdmin, loading: roleLoading } = useRole();

  const [overview, setOverview] = useState<Overview | null>(null);
  const [dashboards, setDashboards] = useState<DashboardRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [viewsData, setViewsData] = useState<ViewsData | null>(null);
  const [storageData, setStorageData] = useState<StorageData | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [deptCounts, setDeptCounts] = useState<Record<string, number>>({});
  const [orgDepartments, setOrgDepartments] = useState<Department[]>([]);
  const [mcpSummary, setMcpSummary] = useState<McpStatsSummary | null>(null);
  const [mcpServerStats, setMcpServerStats] = useState<McpServerStat[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [userDeptFilter, setUserDeptFilter] = useState<string>("all");
  const [dashSort, setDashSort] = useState<{ key: keyof DashboardRow; desc: boolean }>({
    key: "viewCount",
    desc: true,
  });

  useEffect(() => {
    if (authLoading || roleLoading) return;
    if (!isAdmin) {
      router.push("/");
      return;
    }

    async function loadAll() {
      try {
        // Core data for all admins
        const corePromises = [
          authFetch("/api/admin/overview"),
          authFetch("/api/admin/dashboards"),
          authFetch("/api/admin/users"),
          authFetch("/api/admin/views?days=30"),
          authFetch("/api/admin/storage"),
        ];
        // Sensitive data only for superadmins
        const superPromises = isSuperAdmin
          ? [
              authFetch("/api/admin/categories"),
              authFetch("/api/admin/departments"),
              authFetch("/api/admin/mcp-stats"),
            ]
          : [Promise.resolve(null), Promise.resolve(null), Promise.resolve(null)];

        const results = await Promise.all([...corePromises, ...superPromises]);
        const [ovRes, dashRes, usersRes, viewsRes, storageRes] = results.slice(0, 5) as Response[];
        const catRes = results[5] as Response | null;
        const deptRes = results[6] as Response | null;
        const mcpStatsRes = results[7] as Response | null;

        if (ovRes.ok) setOverview(await ovRes.json());
        let allDashboards: DashboardRow[] = [];
        if (dashRes.ok) {
          const d = await dashRes.json();
          allDashboards = d.dashboards || [];
          setDashboards(allDashboards);
        }
        if (usersRes.ok) {
          const u = await usersRes.json();
          setUsers(u.users || []);
        }
        if (viewsRes.ok) setViewsData(await viewsRes.json());
        if (storageRes.ok) setStorageData(await storageRes.json());
        if (catRes?.ok) {
          const c = await catRes.json();
          setDepartments(c.categories || []);
        }
        if (deptRes?.ok) {
          const d = await deptRes.json();
          setOrgDepartments(d.departments || []);
        }
        if (mcpStatsRes?.ok) {
          const m = await mcpStatsRes.json();
          setMcpSummary(m.summary || null);
          setMcpServerStats(m.stats || []);
        }

        // Count dashboards per category
        const counts: Record<string, number> = {};
        for (const d of allDashboards) {
          const cat = d.category || "Other";
          counts[cat] = (counts[cat] || 0) + 1;
        }
        setDeptCounts(counts);
      } catch (err) {
        console.error("Admin data load failed:", err);
      } finally {
        setLoadingData(false);
      }
    }

    loadAll();
  }, [authLoading, roleLoading, isAdmin, isSuperAdmin, router]);

  if (authLoading || roleLoading || loadingData) {
    return <AdminSkeleton />;
  }

  if (!isAdmin) return null;

  // Build tool → MCP server name map from stats
  const toolToMcpName = new Map<string, string>();
  for (const s of mcpServerStats) {
    // We don't have tool names in stats, but we can get them from the API
    // For now, use dashboard-level cross-ref: check which MCPs a dashboard uses
  }

  // Build MCP access map: userId → MCP server names (active servers only)
  const userMcpAccess = new Map<string, string[]>();
  for (const s of mcpServerStats) {
    if (!s.active) continue; // Skip inactive servers — matches runtime access filtering
    for (const uid of s.assignedUsers) {
      const existing = userMcpAccess.get(uid) || [];
      existing.push(s.name);
      userMcpAccess.set(uid, existing);
    }
    // Also map via departments
    for (const deptId of s.assignedDepartments) {
      for (const u of users) {
        if (u.department === deptId) {
          const existing = userMcpAccess.get(u.uid) || [];
          if (!existing.includes(s.name)) {
            existing.push(s.name);
            userMcpAccess.set(u.uid, existing);
          }
        }
      }
    }
  }

  // Build dashboardId → MCP names map from stats
  const dashMcpNames = new Map<string, string[]>();
  for (const s of mcpServerStats) {
    for (const d of s.dashboards || []) {
      const existing = dashMcpNames.get(d.id) || [];
      existing.push(s.name);
      dashMcpNames.set(d.id, existing);
    }
  }

  // Count AI dashboards per user
  const userAiDashCount = new Map<string, number>();
  for (const d of dashboards) {
    if (d.source === "ai") {
      const count = userAiDashCount.get(d.ownerEmail) || 0;
      userAiDashCount.set(d.ownerEmail, count + 1);
    }
  }

  // Sort dashboards
  const sortedDashboards = [...dashboards].sort((a, b) => {
    const aVal = a[dashSort.key];
    const bVal = b[dashSort.key];
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    if (typeof aVal === "number" && typeof bVal === "number") {
      return dashSort.desc ? bVal - aVal : aVal - bVal;
    }
    const cmp = String(aVal).localeCompare(String(bVal));
    return dashSort.desc ? -cmp : cmp;
  });

  function handleDashSort(key: keyof DashboardRow) {
    setDashSort((prev) =>
      prev.key === key ? { key, desc: !prev.desc } : { key, desc: true }
    );
  }

  const sortIndicator = (key: keyof DashboardRow) =>
    dashSort.key === key ? (dashSort.desc ? " ↓" : " ↑") : "";

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Platform analytics and access metrics
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="dashboards">Dashboards</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="access">Access</TabsTrigger>
            <TabsTrigger value="storage">Storage</TabsTrigger>
            {isSuperAdmin && (
              <>
                <TabsTrigger value="mcp">MCP Servers</TabsTrigger>
                <TabsTrigger value="mcp-access">
                  <Shield className="size-4 mr-1" />
                  MCP Access
                </TabsTrigger>
                <TabsTrigger value="org-departments">
                  <Building2 className="size-4 mr-1" />
                  Departments
                </TabsTrigger>
                <TabsTrigger value="departments">Categories</TabsTrigger>
                <TabsTrigger value="prompts">
                  <Sparkles className="size-4 mr-1" />
                  Prompts
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* ---- Overview ---- */}
          <TabsContent value="overview" className="space-y-6">
            {overview && (
              <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
                <StatCard
                  title="Dashboards"
                  value={overview.dashboards.total}
                  subtitle={`${overview.dashboards.active} active · ${overview.dashboards.archived} archived`}
                  icon={LayoutDashboard}
                />
                <StatCard
                  title="Users"
                  value={overview.users.total}
                  subtitle={`${overview.users.active7d} active 7d · ${overview.users.active30d} active 30d`}
                  icon={Users}
                />
                <StatCard
                  title="Total Views"
                  value={overview.views.total.toLocaleString()}
                  subtitle={`${overview.views.last7d} last 7d · ${overview.views.last30d} last 30d`}
                  icon={Eye}
                />
                <StatCard
                  title="Storage"
                  value={formatBytes(overview.storage.totalBytes)}
                  icon={HardDrive}
                />
                <StatCard
                  title="Embed Tokens"
                  value={overview.embedTokens.active}
                  subtitle={`${overview.embedTokens.expired} expired`}
                  icon={Code}
                />
                {isSuperAdmin && mcpSummary && (
                  <>
                    <StatCard
                      title="AI Dashboards"
                      value={mcpSummary.aiDashboardCount}
                      subtitle={`of ${overview.dashboards.total} total`}
                      icon={Sparkles}
                    />
                    <StatCard
                      title="MCP Servers"
                      value={mcpSummary.activeServerCount}
                      subtitle={mcpSummary.totalServerCount !== mcpSummary.activeServerCount ? `${mcpSummary.totalServerCount} total` : "all active"}
                      icon={Server}
                    />
                  </>
                )}
              </div>
            )}

            {/* Quick views chart */}
            {viewsData && viewsData.timeSeries.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Views — Last 30 Days</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={viewsData.timeSeries}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(d: string) => d.slice(5)}
                        className="text-xs"
                      />
                      <YAxis className="text-xs" />
                      <Tooltip />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="direct"
                        stackId="1"
                        stroke="hsl(var(--foreground))"
                        fill="hsl(var(--foreground))"
                        fillOpacity={0.3}
                        name="Direct"
                      />
                      <Area
                        type="monotone"
                        dataKey="embed"
                        stackId="1"
                        stroke="hsl(var(--muted-foreground))"
                        fill="hsl(var(--muted-foreground))"
                        fillOpacity={0.3}
                        name="Embed"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ---- Dashboards Leaderboard ---- */}
          <TabsContent value="dashboards">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dashboard Leaderboard</CardTitle>
                <CardDescription>
                  {dashboards.length} dashboards · Click column headers to sort
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th
                          className="pb-2 pr-4 cursor-pointer hover:text-foreground"
                          onClick={() => handleDashSort("title")}
                        >
                          Title{sortIndicator("title")}
                        </th>
                        <th
                          className="hidden md:table-cell pb-2 pr-4 cursor-pointer hover:text-foreground"
                          onClick={() => handleDashSort("ownerName")}
                        >
                          Owner{sortIndicator("ownerName")}
                        </th>
                        <th
                          className="hidden md:table-cell pb-2 pr-4 cursor-pointer hover:text-foreground"
                          onClick={() => handleDashSort("category")}
                        >
                          Category{sortIndicator("category")}
                        </th>
                        <th
                          className="pb-2 pr-4 text-right cursor-pointer hover:text-foreground"
                          onClick={() => handleDashSort("viewCount")}
                        >
                          Views{sortIndicator("viewCount")}
                        </th>
                        <th
                          className="hidden md:table-cell pb-2 pr-4 text-right cursor-pointer hover:text-foreground"
                          onClick={() => handleDashSort("uniqueViewers")}
                        >
                          Unique{sortIndicator("uniqueViewers")}
                        </th>
                        <th
                          className="hidden md:table-cell pb-2 pr-4 text-right cursor-pointer hover:text-foreground"
                          onClick={() => handleDashSort("embedViews")}
                        >
                          Embeds{sortIndicator("embedViews")}
                        </th>
                        <th
                          className="hidden md:table-cell pb-2 pr-4 text-right cursor-pointer hover:text-foreground"
                          onClick={() => handleDashSort("fileSizeBytes")}
                        >
                          Size{sortIndicator("fileSizeBytes")}
                        </th>
                        <th
                          className="pb-2 cursor-pointer hover:text-foreground"
                          onClick={() => handleDashSort("updatedAt")}
                        >
                          Updated{sortIndicator("updatedAt")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedDashboards.map((d) => (
                        <tr
                          key={d.id}
                          className="border-b border-muted hover:bg-muted/50"
                        >
                          <td className="py-2 pr-4 font-medium max-w-[250px]">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="truncate">{d.title}</span>
                              {d.source === "ai" && (
                                <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">
                                  <Sparkles className="size-3 mr-0.5" />
                                  AI
                                </Badge>
                              )}
                              {d.archivedAt && (
                                <span className="text-xs text-muted-foreground shrink-0">
                                  archived
                                </span>
                              )}
                            </div>
                            {isSuperAdmin && d.source === "ai" && (dashMcpNames.get(d.id) || []).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {dashMcpNames.get(d.id)!.map((name) => (
                                  <span
                                    key={name}
                                    className="inline-flex items-center rounded bg-muted px-1.5 py-0 text-[10px] text-muted-foreground"
                                  >
                                    <Server className="size-2.5 mr-0.5" />
                                    {name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="hidden md:table-cell py-2 pr-4 text-muted-foreground truncate max-w-[150px]">
                            {d.ownerName}
                          </td>
                          <td className="hidden md:table-cell py-2 pr-4">{d.category}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {d.viewCount}
                          </td>
                          <td className="hidden md:table-cell py-2 pr-4 text-right tabular-nums">
                            {d.uniqueViewers}
                          </td>
                          <td className="hidden md:table-cell py-2 pr-4 text-right tabular-nums">
                            {d.embedViews}
                          </td>
                          <td className="hidden md:table-cell py-2 pr-4 text-right tabular-nums">
                            {formatBytes(d.fileSizeBytes)}
                          </td>
                          <td className="py-2 text-muted-foreground">
                            {formatDate(d.updatedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---- Users ---- */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">User Activity</CardTitle>
                    <CardDescription>{users.length} registered users</CardDescription>
                  </div>
                  {isSuperAdmin && orgDepartments.length > 0 && (
                    <select
                      value={userDeptFilter}
                      onChange={(e) => setUserDeptFilter(e.target.value)}
                      className="bg-transparent border rounded px-2 py-1 text-sm cursor-pointer"
                    >
                      <option value="all">All Departments</option>
                      <option value="none">No Department</option>
                      {orgDepartments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4">Name</th>
                        <th className="hidden md:table-cell pb-2 pr-4">Email</th>
                        <th className="pb-2 pr-4">Role</th>
                        {isSuperAdmin && <th className="hidden md:table-cell pb-2 pr-4">Department</th>}
                        <th className="hidden md:table-cell pb-2 pr-4 text-right">Dashboards</th>
                        {isSuperAdmin && <th className="hidden lg:table-cell pb-2 pr-4">MCP Access</th>}
                        <th className="hidden md:table-cell pb-2 pr-4 text-right">Views Generated</th>
                        <th className="pb-2">Last Login</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users
                        .filter((u) => {
                          if (userDeptFilter === "all") return true;
                          if (userDeptFilter === "none") return !u.department;
                          return u.department === userDeptFilter;
                        })
                        .map((u) => {
                          const deptName = u.department
                            ? orgDepartments.find((d) => d.id === u.department)?.name
                            : undefined;
                          return (
                            <tr
                              key={u.uid}
                              className="border-b border-muted hover:bg-muted/50"
                            >
                              <td className="py-2 pr-4 font-medium">
                                {u.displayName}
                              </td>
                              <td className="hidden md:table-cell py-2 pr-4 text-muted-foreground">
                                {u.email}
                              </td>
                              <td className="py-2 pr-4">
                                {isSuperAdmin ? (
                                  <select
                                    value={u.role}
                                    onChange={async (e) => {
                                      const newRole = e.target.value;
                                      if (newRole === u.role) return;
                                      if (
                                        !confirm(
                                          `Change ${u.displayName}'s role from "${u.role}" to "${newRole}"?`
                                        )
                                      ) {
                                        e.target.value = u.role;
                                        return;
                                      }
                                      try {
                                        const res = await authFetch("/api/admin/users", {
                                          method: "PATCH",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ uid: u.uid, role: newRole }),
                                        });
                                        if (!res.ok) {
                                          const err = await res.json();
                                          throw new Error(err.error || "Failed");
                                        }
                                        setUsers((prev) =>
                                          prev.map((user) =>
                                            user.uid === u.uid ? { ...user, role: newRole } : user
                                          )
                                        );
                                        toast.success(`${u.displayName} is now ${newRole}`);
                                      } catch (err) {
                                        e.target.value = u.role;
                                        toast.error(
                                          err instanceof Error ? err.message : "Failed to update role"
                                        );
                                      }
                                    }}
                                    className={`bg-transparent border rounded px-1.5 py-0.5 text-sm cursor-pointer ${
                                      u.role === "superadmin"
                                        ? "text-amber-600 font-medium border-amber-300"
                                        : u.role === "admin"
                                          ? "text-blue-600 font-medium border-blue-300"
                                          : "text-muted-foreground border-muted"
                                    }`}
                                  >
                                    <option value="user">user</option>
                                    <option value="admin">admin</option>
                                    <option value="superadmin">superadmin</option>
                                  </select>
                                ) : (
                                  <span
                                    className={`inline-flex rounded border px-1.5 py-0.5 text-sm ${
                                      u.role === "superadmin"
                                        ? "text-amber-600 font-medium border-amber-300"
                                        : u.role === "admin"
                                          ? "text-blue-600 font-medium border-blue-300"
                                          : "text-muted-foreground border-muted"
                                    }`}
                                  >
                                    {u.role}
                                  </span>
                                )}
                              </td>
                              {isSuperAdmin && (
                                <td className="hidden md:table-cell py-2 pr-4">
                                  {deptName ? (
                                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                                      {deptName}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  )}
                                </td>
                              )}
                              <td className="hidden md:table-cell py-2 pr-4 text-right tabular-nums">
                                <span>{u.dashboardsCreated}</span>
                                {(userAiDashCount.get(u.email) || 0) > 0 && (
                                  <Badge variant="secondary" className="ml-1.5 text-[10px] px-1 py-0">
                                    <Sparkles className="size-2.5 mr-0.5" />
                                    {userAiDashCount.get(u.email)}
                                  </Badge>
                                )}
                              </td>
                              {isSuperAdmin && (
                                <td className="hidden lg:table-cell py-2 pr-4">
                                  {(userMcpAccess.get(u.uid) || []).length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {userMcpAccess.get(u.uid)!.map((name) => (
                                        <span
                                          key={name}
                                          className="inline-flex items-center rounded bg-muted px-1.5 py-0 text-[10px] font-medium"
                                        >
                                          {name}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  )}
                                </td>
                              )}
                              <td className="hidden md:table-cell py-2 pr-4 text-right tabular-nums">
                                {u.totalViewsGenerated}
                              </td>
                              <td className="py-2 text-muted-foreground">
                                {formatDate(u.lastLoginAt)}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---- Access Analytics ---- */}
          <TabsContent value="access" className="space-y-6">
            {viewsData && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Daily Views — Direct vs Embed
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={viewsData.timeSeries}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(d: string) => d.slice(5)}
                          className="text-xs"
                        />
                        <YAxis className="text-xs" />
                        <Tooltip />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="direct"
                          stackId="1"
                          stroke="hsl(var(--foreground))"
                          fill="hsl(var(--foreground))"
                          fillOpacity={0.3}
                          name="Direct"
                        />
                        <Area
                          type="monotone"
                          dataKey="embed"
                          stackId="1"
                          stroke="hsl(var(--muted-foreground))"
                          fill="hsl(var(--muted-foreground))"
                          fillOpacity={0.3}
                          name="Embed"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {viewsData.topEmbedded.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        Top Embedded Dashboards
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={Math.max(200, viewsData.topEmbedded.length * 40)}>
                        <BarChart
                          data={viewsData.topEmbedded}
                          layout="vertical"
                          margin={{ left: 120 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis type="number" className="text-xs" />
                          <YAxis
                            type="category"
                            dataKey="title"
                            className="text-xs"
                            width={120}
                            tick={{ fontSize: 12 }}
                          />
                          <Tooltip />
                          <Bar
                            dataKey="count"
                            fill="hsl(var(--foreground))"
                            fillOpacity={0.7}
                            name="Embed Views"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {viewsData.embedTokens.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Embed Tokens</CardTitle>
                      <CardDescription>
                        {viewsData.embedTokens.filter((t) => t.isActive).length}{" "}
                        active ·{" "}
                        {viewsData.embedTokens.filter((t) => !t.isActive).length}{" "}
                        expired
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="pb-2 pr-4">Dashboard</th>
                              <th className="pb-2 pr-4">Created By</th>
                              <th className="pb-2 pr-4">Created</th>
                              <th className="pb-2 pr-4">Expires</th>
                              <th className="pb-2">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {viewsData.embedTokens.map((t, i) => (
                              <tr
                                key={i}
                                className="border-b border-muted hover:bg-muted/50"
                              >
                                <td className="py-2 pr-4 font-medium">
                                  {t.dashboardTitle}
                                </td>
                                <td className="py-2 pr-4 text-muted-foreground">
                                  {t.createdByEmail}
                                </td>
                                <td className="py-2 pr-4 text-muted-foreground">
                                  {formatDate(t.createdAt)}
                                </td>
                                <td className="py-2 pr-4 text-muted-foreground">
                                  {formatDate(t.expiresAt)}
                                </td>
                                <td className="py-2">
                                  <span
                                    className={
                                      t.isActive
                                        ? "text-emerald-600"
                                        : "text-muted-foreground"
                                    }
                                  >
                                    {t.isActive ? "Active" : "Expired"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* ---- Storage ---- */}
          <TabsContent value="storage" className="space-y-6">
            {storageData && (
              <>
                <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                  <StatCard
                    title="Total Storage"
                    value={formatBytes(storageData.totalBytes)}
                    icon={HardDrive}
                  />
                  <StatCard
                    title="Version Storage"
                    value={formatBytes(storageData.versions.totalBytes)}
                    subtitle={`${storageData.versions.totalCount} versions`}
                    icon={FileText}
                  />
                  <StatCard
                    title="Large Files (>5MB)"
                    value={storageData.largeFiles.length}
                    icon={Activity}
                  />
                  <StatCard
                    title="Combined"
                    value={formatBytes(
                      storageData.totalBytes + storageData.versions.totalBytes
                    )}
                    subtitle="Dashboards + versions"
                    icon={TrendingUp}
                  />
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        Storage by User
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={Math.max(200, storageData.byUser.length * 40)}>
                        <BarChart
                          data={storageData.byUser}
                          layout="vertical"
                          margin={{ left: 100 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis
                            type="number"
                            tickFormatter={(v: number) => formatBytes(v)}
                            className="text-xs"
                          />
                          <YAxis
                            type="category"
                            dataKey="email"
                            className="text-xs"
                            width={100}
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v: string) => v.split("@")[0]}
                          />
                          <Tooltip
                            formatter={(v) => formatBytes(Number(v))}
                          />
                          <Bar
                            dataKey="bytes"
                            fill="hsl(var(--foreground))"
                            fillOpacity={0.7}
                            name="Storage"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        Storage by Category
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={Math.max(200, storageData.byCategory.length * 50)}>
                        <BarChart
                          data={storageData.byCategory}
                          layout="vertical"
                          margin={{ left: 80 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis
                            type="number"
                            tickFormatter={(v: number) => formatBytes(v)}
                            className="text-xs"
                          />
                          <YAxis
                            type="category"
                            dataKey="category"
                            className="text-xs"
                            width={80}
                          />
                          <Tooltip
                            formatter={(v) => formatBytes(Number(v))}
                          />
                          <Bar
                            dataKey="bytes"
                            fill="hsl(var(--foreground))"
                            fillOpacity={0.7}
                            name="Storage"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                {storageData.largeFiles.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        Large Files (&gt;5MB)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-2 pr-4">Title</th>
                            <th className="pb-2 pr-4">File Name</th>
                            <th className="pb-2 pr-4">Owner</th>
                            <th className="pb-2 text-right">Size</th>
                          </tr>
                        </thead>
                        <tbody>
                          {storageData.largeFiles.map((f) => (
                            <tr
                              key={f.id}
                              className="border-b border-muted hover:bg-muted/50"
                            >
                              <td className="py-2 pr-4 font-medium">
                                {f.title}
                              </td>
                              <td className="py-2 pr-4 text-muted-foreground">
                                {f.fileName}
                              </td>
                              <td className="py-2 pr-4 text-muted-foreground">
                                {f.ownerEmail}
                              </td>
                              <td className="py-2 text-right tabular-nums">
                                {formatBytes(f.fileSizeBytes)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* ---- MCP Servers (superadmin only) ---- */}
          {isSuperAdmin && (
            <TabsContent value="mcp">
              <McpServersTab isSuperAdmin={isSuperAdmin} />
            </TabsContent>
          )}

          {/* ---- MCP Access (superadmin only) ---- */}
          {isSuperAdmin && <TabsContent value="mcp-access">
            <McpAccessTab
              departments={orgDepartments}
              allUsers={users.map((u) => ({
                uid: u.uid,
                email: u.email,
                displayName: u.displayName,
              }))}
              isSuperAdmin={isSuperAdmin}
            />
          </TabsContent>}

          {/* ---- Org Departments (superadmin only) ---- */}
          {isSuperAdmin && <TabsContent value="org-departments">
            <DepartmentsTab
              departments={orgDepartments}
              allUsers={users.map((u) => ({
                uid: u.uid,
                email: u.email,
                displayName: u.displayName,
              }))}
              isSuperAdmin={isSuperAdmin}
              onRefresh={async () => {
                try {
                  const [deptRes, usersRes] = await Promise.all([
                    authFetch("/api/admin/departments"),
                    authFetch("/api/admin/users"),
                  ]);
                  if (deptRes.ok) {
                    const d = await deptRes.json();
                    setOrgDepartments(d.departments || []);
                  }
                  if (usersRes.ok) {
                    const u = await usersRes.json();
                    setUsers(u.users || []);
                  }
                } catch { /* ignore */ }
              }}
            />
          </TabsContent>}

          {/* ---- Categories (dashboard categories, superadmin only) ---- */}
          {isSuperAdmin && <TabsContent value="departments">
            <DepartmentsPanel
              departments={departments}
              deptCounts={deptCounts}
              onUpdate={async (updated) => {
                setDepartments(updated);
                // Refresh dashboard list + counts to stay in sync
                try {
                  const dashRes = await authFetch("/api/admin/dashboards");
                  if (dashRes.ok) {
                    const d = await dashRes.json();
                    const fresh = d.dashboards || [];
                    setDashboards(fresh);
                    const counts: Record<string, number> = {};
                    for (const db of fresh) {
                      const cat = (db as DashboardRow).category || "Other";
                      counts[cat] = (counts[cat] || 0) + 1;
                    }
                    setDeptCounts(counts);
                  }
                } catch { /* stale counts are acceptable fallback */ }
              }}
            />
          </TabsContent>}

          {/* ---- Prompts (superadmin only) ---- */}
          {isSuperAdmin && (
            <TabsContent value="prompts">
              <PromptsTab />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppShell>
  );
}
