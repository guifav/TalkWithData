"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/hooks/use-role";
import { useAuth } from "@/hooks/use-auth";
import { authFetch } from "@/lib/firebase/auth";
import { AppShell } from "@/components/layout/app-shell";
import { AdminSkeleton } from "@/components/skeletons/admin-skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Building2, Sparkles } from "lucide-react";
import { McpServersTab } from "@/components/admin/mcp-servers-tab";
import { McpAccessTab } from "@/components/admin/mcp-access-tab";
import type { Department } from "@/lib/types";
import { DepartmentsTab } from "@/components/admin/departments-tab";
import { PromptsTab } from "@/components/admin/prompts-tab";
import { AiConfigTab } from "@/components/admin/ai-config-tab";
import { OverviewTab } from "@/components/admin/overview-tab";
import { DashboardsTab } from "@/components/admin/dashboards-tab";
import { UsersTab } from "@/components/admin/users-tab";
import { AccessTab } from "@/components/admin/access-tab";
import { StorageTab } from "@/components/admin/storage-tab";
import { DepartmentsPanel } from "@/components/admin/categories-panel";
import type {
  Overview,
  DashboardRow,
  UserRow,
  McpStatsSummary,
  McpServerStat,
  ViewsData,
  StorageData,
} from "@/components/admin/admin-shared";

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
                <TabsTrigger value="ai-config">
                  <Sparkles className="size-4 mr-1" />
                  AI Models
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* ---- Overview ---- */}
          <TabsContent value="overview" className="space-y-6">
            <OverviewTab
              overview={overview}
              mcpSummary={mcpSummary}
              isSuperAdmin={isSuperAdmin}
              viewsData={viewsData}
            />
          </TabsContent>

          {/* ---- Dashboards Leaderboard ---- */}
          <TabsContent value="dashboards">
            <DashboardsTab
              dashboards={dashboards}
              sortedDashboards={sortedDashboards}
              handleDashSort={handleDashSort}
              sortIndicator={sortIndicator}
              isSuperAdmin={isSuperAdmin}
              dashMcpNames={dashMcpNames}
            />
          </TabsContent>

          {/* ---- Users ---- */}
          <TabsContent value="users">
            <UsersTab
              users={users}
              setUsers={setUsers}
              isSuperAdmin={isSuperAdmin}
              orgDepartments={orgDepartments}
              userDeptFilter={userDeptFilter}
              setUserDeptFilter={setUserDeptFilter}
              userAiDashCount={userAiDashCount}
              userMcpAccess={userMcpAccess}
            />
          </TabsContent>

          {/* ---- Access Analytics ---- */}
          <TabsContent value="access" className="space-y-6">
            <AccessTab viewsData={viewsData} />
          </TabsContent>

          {/* ---- Storage ---- */}
          <TabsContent value="storage" className="space-y-6">
            <StorageTab storageData={storageData} />
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
          {isSuperAdmin && <TabsContent value="prompts">
            <PromptsTab />
          </TabsContent>}

          {/* ---- AI Models (superadmin only) ---- */}
          {isSuperAdmin && <TabsContent value="ai-config">
            <AiConfigTab users={users} onUsersUpdate={(updated) => setUsers(updated as UserRow[])} />
          </TabsContent>}
        </Tabs>
      </div>
    </AppShell>
  );
}
