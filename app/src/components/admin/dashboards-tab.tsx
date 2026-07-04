"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Server, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatBytes, formatDate } from "@/components/admin/admin-shared";
import type { DashboardRow } from "@/components/admin/admin-shared";

export function DashboardsTab({
  dashboards,
  sortedDashboards,
  handleDashSort,
  sortIndicator,
  isSuperAdmin,
  dashMcpNames,
}: {
  dashboards: DashboardRow[];
  sortedDashboards: DashboardRow[];
  handleDashSort: (key: keyof DashboardRow) => void;
  sortIndicator: (key: keyof DashboardRow) => string;
  isSuperAdmin: boolean;
  dashMcpNames: Map<string, string[]>;
}) {
  return (
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
  );
}
