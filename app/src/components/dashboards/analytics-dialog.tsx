"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/firebase/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Eye, Users, TrendingUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AnalyticsData {
  totalViews: number;
  uniqueViewers: number;
  viewsThisWeek: number;
  daily: Array<{ date: string; count: number }>;
  viewers: Array<{
    uid: string;
    email: string;
    displayName: string;
    lastAccess: number;
    viewCount: number;
  }>;
}

function MiniBarChart({ data }: { data: Array<{ date: string; count: number }> }) {
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="flex items-end gap-px h-24">
      {data.map((d) => (
        <div
          key={d.date}
          className="flex-1 min-w-0 group relative"
          title={`${d.date}: ${d.count} views`}
        >
          <div
            className="w-full bg-primary/70 rounded-t-sm transition-all hover:bg-primary"
            style={{
              height: `${Math.max((d.count / max) * 100, 2)}%`,
            }}
          />
        </div>
      ))}
    </div>
  );
}

function formatLastAccess(ts: number): string {
  if (!ts) return "Never";
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AnalyticsDialog({
  dashboardId,
  dashboardTitle,
  open,
  onOpenChange,
}: {
  dashboardId: string;
  dashboardTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);

    authFetch(`/api/dashboards/${dashboardId}/analytics`)
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch(() => toast.error("Failed to load analytics"))
      .finally(() => setLoading(false));
  }, [dashboardId, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="size-5" />
            Analytics
          </DialogTitle>
          <p className="text-sm text-muted-foreground truncate">
            {dashboardTitle}
          </p>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center">
            <Loader2 className="size-5 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : !data ? (
          <div className="py-8 text-center text-muted-foreground">
            Failed to load analytics.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stat Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <Eye className="size-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-2xl font-semibold">{data.totalViews}</p>
                <p className="text-xs text-muted-foreground">Total Views</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <Users className="size-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-2xl font-semibold">{data.uniqueViewers}</p>
                <p className="text-xs text-muted-foreground">
                  Unique Viewers
                </p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <TrendingUp className="size-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-2xl font-semibold">{data.viewsThisWeek}</p>
                <p className="text-xs text-muted-foreground">This Week</p>
              </div>
            </div>

            {/* Chart */}
            <div>
              <h4 className="text-sm font-medium mb-2">Last 30 Days</h4>
              <MiniBarChart data={data.daily} />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{data.daily[0]?.date}</span>
                <span>{data.daily[data.daily.length - 1]?.date}</span>
              </div>
            </div>

            {/* Viewers */}
            {data.viewers.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Viewers</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {data.viewers.map((v) => (
                    <div
                      key={v.uid}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{v.displayName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {v.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <Badge variant="outline" className="text-xs">
                          {v.viewCount}×
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatLastAccess(v.lastAccess)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
