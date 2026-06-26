"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useMcpAccess } from "@/hooks/mcp-access-context";
import { AppShell } from "@/components/layout/app-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Database,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import type { McpServer } from "@/lib/types";

function McpCard({ server }: { server: McpServer }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {expanded ? (
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            )}
            <CardTitle className="text-base line-clamp-1">
              {server.name}
            </CardTitle>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="outline">
              <Wrench className="size-3 mr-1" />
              {server.toolCount} {server.toolCount === 1 ? "tool" : "tools"}
            </Badge>

          </div>
        </div>
        {server.description && (
          <CardDescription className={expanded ? "" : "line-clamp-2"}>
            {server.description}
          </CardDescription>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          {server.tools.length > 0 ? (
            <div className="space-y-3">
              {server.tools.map((tool) => (
                <div
                  key={tool.name}
                  className="rounded-md border p-3 space-y-1"
                >
                  <p className="text-sm font-medium">{tool.name}</p>
                  {tool.description && (
                    <p className="text-xs text-muted-foreground">
                      {tool.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No tools available for this data source.
            </p>
          )}

          <Button asChild variant="outline" size="sm">
            <Link href={`/chat?mcp=${server.id}`}>
              <MessageSquare className="size-4" />
              Chat about this
            </Link>
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

function ExploreSkeleton() {
  return (
    <AppShell>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-10 w-full max-w-sm" />
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </AppShell>
  );
}

export default function ExplorePage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { hasAccess, mcpServers, loading: mcpLoading } = useMcpAccess();
  const router = useRouter();
  const [search, setSearch] = useState("");

  // Auth gate — must be in useEffect to avoid mutating router during render
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || mcpLoading) {
    return <ExploreSkeleton />;
  }

  if (!isAuthenticated) {
    return <ExploreSkeleton />;
  }

  if (!hasAccess) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Database className="size-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold">No data sources assigned</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Contact your admin to get access to data sources.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/">Back to Home</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const q = search.toLowerCase();
  const filtered = q
    ? mcpServers.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tools.some(
            (t) =>
              t.name.toLowerCase().includes(q) ||
              t.description.toLowerCase().includes(q)
          )
      )
    : mcpServers;

  return (
    <AppShell>
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Explore Your Data
          </h1>
          <p className="text-muted-foreground mt-1">
            Browse your authorized data sources and the tools available in each
            one.
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search data sources and tools..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* MCP List */}
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <p>No data sources match your search.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((server) => (
              <McpCard key={server.id} server={server} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
