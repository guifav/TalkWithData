"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LayoutDashboard,
  Users,
  Eye,
  HardDrive,
  Code,
  Server,
  Sparkles,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { StatCard } from "@/components/admin/stat-card";
import { formatBytes } from "@/components/admin/admin-shared";
import type {
  Overview,
  McpStatsSummary,
  ViewsData,
} from "@/components/admin/admin-shared";

export function OverviewTab({
  overview,
  mcpSummary,
  isSuperAdmin,
  viewsData,
}: {
  overview: Overview | null;
  mcpSummary: McpStatsSummary | null;
  isSuperAdmin: boolean;
  viewsData: ViewsData | null;
}) {
  return (
    <>
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
    </>
  );
}
