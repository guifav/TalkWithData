"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboardByIdOrSlug } from "@/lib/firestore/dashboards";
import type { Dashboard } from "@/lib/types";

/**
 * Token-based embed: renders iframe directly using the server-side
 * view API with embed_token — no client Firestore read needed.
 */
function TokenEmbed({ id, token }: { id: string; token: string }) {
  // Cache-bust: Date.now() per mount ensures fresh HTML after replace/restore.
  // The server already sends no-store, but this defends against intermediate caches.
  const [bust] = useState(() => Date.now());
  return (
    <iframe
      src={`/api/dashboards/${id}/view?embed_token=${token}&v=${bust}`}
      sandbox="allow-scripts"
      className="h-screen w-screen border-0"
      title="Dashboard"
    />
  );
}

/**
 * Authenticated embed: standard flow with client-side Firestore read.
 * Requires the user to be logged in (cookie-based auth).
 */
function AuthEmbed({ id }: { id: string }) {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loadingDash, setLoadingDash] = useState(true);

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
      } catch {
        // silent
      } finally {
        setLoadingDash(false);
      }
    }
    load();
  }, [id, isAuthenticated]);

  if (loading || loadingDash) {
    return (
      <div className="h-screen w-screen">
        <Skeleton className="w-full h-full" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Dashboard not found</p>
      </div>
    );
  }

  const liveVersion =
    dashboard.updatedAt?.toMillis() ?? dashboard.createdAt.toMillis();

  return (
    <iframe
      key={`${dashboard.id}:${liveVersion}`}
      src={`/api/dashboards/${dashboard.id}/view?v=${liveVersion}`}
      sandbox="allow-scripts"
      className="h-screen w-screen border-0"
      title={dashboard.title}
    />
  );
}

export default function EmbedPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params?.id ?? "";
  const embedToken = searchParams?.get("token") ?? null;

  if (!id) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Invalid embed URL</p>
      </div>
    );
  }

  // Token flow: no Firestore read, no auth dependency
  if (embedToken) {
    return <TokenEmbed id={id} token={embedToken} />;
  }

  // Authenticated flow: requires login + client Firestore read
  return <AuthEmbed id={id} />;
}
