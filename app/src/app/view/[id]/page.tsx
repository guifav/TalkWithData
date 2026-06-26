"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { getDashboardByIdOrSlug } from "@/lib/firestore/dashboards";
import { trackRecentView } from "@/lib/firestore/favorites";
import type { Dashboard } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Share2, Code, RefreshCw, Pencil, Settings2 } from "lucide-react";
import Link from "next/link";
import { authFetch } from "@/lib/firebase/auth";
import { toast } from "sonner";
import { ViewSkeleton } from "@/components/skeletons/view-skeleton";
import { useDashboardFields } from "@/hooks/use-dashboard-fields";
import { SchemaBuilder } from "@/components/fields/schema-builder";
import { FieldEditorPanel } from "@/components/fields/field-editor-panel";
import { shouldPollDashboardRefresh } from "@/lib/dashboard-refresh-client";
import type { DashboardRefreshStatus } from "@/lib/dashboard-refresh-status";

type RefreshResponse = {
  status?: DashboardRefreshStatus;
  refreshedAt?: string;
  lastRefreshedAt?: string;
  error?: string;
};

const REFRESH_POLL_INTERVAL_MS = 5_000;
const REFRESH_POLL_TIMEOUT_MS = 6 * 60 * 1000;

export default function ViewPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const router = useRouter();
  const { firebaseUser, isAuthenticated, loading } = useAuth();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loadingDash, setLoadingDash] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [schemaBuilderOpen, setSchemaBuilderOpen] = useState(false);
  const dashboardFields = useDashboardFields(dashboard?.id ?? null);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (!id || !isAuthenticated) return;

    async function load() {
      try {
        const d = await getDashboardByIdOrSlug(id);
        setDashboard(d);
        if (d) {
          // Track recently viewed for the current user
          if (firebaseUser) {
            trackRecentView(firebaseUser.uid, d.id).catch(() => {});
          }
        }
      } catch {
        toast.error("Failed to load dashboard");
      } finally {
        setLoadingDash(false);
      }
    }
    load();
  }, [id, isAuthenticated]);

  const isOwner = firebaseUser?.uid === dashboard?.createdBy;
  const liveVersion = dashboard
    ? (dashboard.updatedAt?.toMillis() ?? dashboard.createdAt.toMillis()) + refreshVersion
    : 0;

  // Check if dashboard data is stale
  const isAiDashboard = dashboard?.source === "ai";
  const aiRecipe = (dashboard as unknown as Record<string, unknown>)?.aiRecipe as
    | { lastRefreshedAt?: string; staleAfterHours?: number; queries?: unknown[]; generationPrompt?: string }
    | undefined;
  // Dashboard is refreshable only if it has a prompt AND saved MCP server refs
  const hasSavedMcpRefs = (aiRecipe?.queries as Array<{ mcpServerId?: string }> | undefined)?.some(
    (q) => !!q.mcpServerId
  ) ?? false;
  const isRefreshable = isAiDashboard && !!aiRecipe?.generationPrompt && hasSavedMcpRefs;

  const isStale = (() => {
    if (!isRefreshable) return false;
    if (!aiRecipe?.lastRefreshedAt) return true; // Never refreshed
    const lastRefreshed = new Date(aiRecipe.lastRefreshedAt).getTime();
    const staleAfterMs = (aiRecipe.staleAfterHours || 168) * 60 * 60 * 1000;
    return Date.now() - lastRefreshed > staleAfterMs;
  })();

  // Auto-refresh on open when data is stale
  const autoRefreshTriggered = useRef(false);
  useEffect(() => {
    if (isStale && !isRefreshing && !autoRefreshTriggered.current && dashboard) {
      autoRefreshTriggered.current = true;
      handleRefresh();
    }
  }, [isStale, dashboard]);

  const handleRefresh = async () => {
    if (!dashboard || isRefreshing) return;
    setIsRefreshing(true);

    const markRefreshComplete = (refreshedAt?: string) => {
      toast.success("Dashboard refreshed with latest data!");
      setRefreshVersion((v) => v + 1);
      setDashboard({
        ...dashboard,
        aiRecipe: {
          ...(dashboard as unknown as Record<string, unknown>).aiRecipe as Record<string, unknown>,
          lastRefreshedAt: refreshedAt || new Date().toISOString(),
        },
      } as Dashboard);
    };

    const pollRefreshStatus = async () => {
      const startedAt = Date.now();
      while (Date.now() - startedAt < REFRESH_POLL_TIMEOUT_MS) {
        await new Promise((r) => setTimeout(r, REFRESH_POLL_INTERVAL_MS));

        const res = await authFetch(`/api/dashboards/${dashboard.id}/refresh`);
        if (!res.ok) continue;

        const body = await res.json().catch(() => ({})) as RefreshResponse;
        if (body.status === "completed" || body.status === "recently_completed") {
          markRefreshComplete(body.refreshedAt || body.lastRefreshedAt);
          return;
        }
        if (body.status === "failed") {
          toast.error(body.error || "Failed to refresh dashboard");
          return;
        }
        if (body.status === "idle") {
          toast.error("Refresh did not start. Please try again.");
          return;
        }
      }

      toast.info("Refresh is still running. The dashboard will show updated data when it finishes.");
    };

    try {
      const res = await authFetch(`/api/dashboards/${dashboard.id}/refresh`, {
        method: "POST",
      });

      const body = await res.json().catch(() => ({})) as RefreshResponse;

      if (res.ok && (body.status === "completed" || body.status === "recently_completed")) {
        markRefreshComplete(body.refreshedAt || body.lastRefreshedAt);
      } else if (res.status === 202 && shouldPollDashboardRefresh(body.status || "running")) {
        toast.info("Refresh started. Waiting for updated data...");
        await pollRefreshStatus();
      } else {
        toast.error(body.error || "Failed to refresh dashboard");
      }
    } catch {
      try {
        toast.info("Refresh may still be running. Checking status...");
        await pollRefreshStatus();
      } catch {
        toast.error("Failed to refresh dashboard");
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCopyEmbedLink = async () => {
    if (!dashboard) return;
    try {
      const res = await authFetch(`/api/dashboards/${dashboard.id}/embed-token`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to generate embed token");
      const data = await res.json();
      await navigator.clipboard.writeText(data.embedUrl);
      toast.success("Embed link copied! Valid for 7 days.");
    } catch {
      toast.error("Failed to generate embed link");
    }
  };

  const handleShare = () => {
    // Share the friendly slug URL if available
    const slug = dashboard?.slug;
    const shareUrl = slug
      ? `${window.location.origin}/view/${slug}`
      : window.location.href;
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied to clipboard");
  };

  if (loading || loadingDash) {
    return <ViewSkeleton />;
  }

  if (!dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Dashboard not found</p>
          <Button variant="outline" onClick={() => router.push("/")}>
            Go back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between border-b px-4 bg-background">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => router.push("/")}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-sm font-medium truncate">
              {dashboard.title}
            </h1>
            <p className="text-xs text-muted-foreground truncate">
              {dashboard.createdByName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isRefreshable && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title={isRefreshing ? "Refreshing..." : "Refresh data"}
            >
              <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" onClick={handleCopyEmbedLink} title="Copy embed link">
            <Code className="size-4" />
          </Button>
          {isOwner && isAiDashboard && (
            <Button variant="ghost" size="icon-sm" asChild title="Edit with AI">
              <Link href={`/create?edit=${dashboard.id}`}>
                <Pencil className="size-4" />
              </Link>
            </Button>
          )}
          {isOwner && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setSchemaBuilderOpen(true)}
              title="Configure fields"
            >
              <Settings2 className="size-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" onClick={handleShare} title="Copy share link">
            <Share2 className="size-4" />
          </Button>
        </div>
      </header>
      {isStale && !isRefreshing && (
        <div className="flex items-center justify-between gap-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            This dashboard&apos;s data may be outdated.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={handleRefresh}
          >
            <RefreshCw className="size-3" />
            Refresh now
          </Button>
        </div>
      )}
      {isRefreshing && (
        <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800 px-4 py-2">
          <RefreshCw className="size-3 animate-spin text-blue-600 dark:text-blue-400" />
          <p className="text-xs text-blue-700 dark:text-blue-400">
            Refreshing data... This may take a minute.
          </p>
        </div>
      )}
      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 overflow-hidden">
        <iframe
          key={`${dashboard.id}:${liveVersion}`}
          src={`/api/dashboards/${dashboard.id}/view?v=${liveVersion}`}
          sandbox="allow-scripts allow-same-origin"
          className="h-full w-full border-0"
          title={dashboard.title}
        />
        </div>
        {isOwner && dashboardFields.fields.length > 0 && (
          <div className="w-72 shrink-0 border-l overflow-y-auto">
            <FieldEditorPanel
              fields={dashboardFields.fields}
              values={dashboardFields.values}
              loading={dashboardFields.loading}
              onSave={dashboardFields.saveValues}
            />
          </div>
        )}
      </div>

      {isOwner && (
        <SchemaBuilder
          open={schemaBuilderOpen}
          onOpenChange={setSchemaBuilderOpen}
          initialFields={dashboardFields.fields}
          loading={dashboardFields.loading}
          onSave={dashboardFields.saveSchema}
        />
      )}
    </div>
  );
}
