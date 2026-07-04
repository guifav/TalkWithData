"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { formatDate } from "@/components/admin/admin-shared";
import type { ViewsData } from "@/components/admin/admin-shared";

export function AccessTab({ viewsData }: { viewsData: ViewsData | null }) {
  return (
    <>
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
    </>
  );
}
