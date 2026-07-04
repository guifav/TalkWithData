"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HardDrive, FileText, Activity, TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { StatCard } from "@/components/admin/stat-card";
import { formatBytes } from "@/components/admin/admin-shared";
import type { StorageData } from "@/components/admin/admin-shared";

export function StorageTab({ storageData }: { storageData: StorageData | null }) {
  return (
    <>
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
    </>
  );
}
