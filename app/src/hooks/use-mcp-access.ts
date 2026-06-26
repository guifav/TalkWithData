"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { authFetch } from "@/lib/firebase/auth";
import type { McpServer } from "@/lib/types";

/**
 * Check if the current user has access to any MCP servers.
 * Returns { hasAccess, mcpServers, loading }.
 */
export function useHasMcpAccess() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setHasAccess(false);
      setMcpServers([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchAccess() {
      try {
        const res = await authFetch("/api/ai/user-mcps");
        if (!res.ok) {
          setHasAccess(false);
          setMcpServers([]);
          return;
        }
        const data = await res.json();
        const servers: McpServer[] = data.mcpServers || [];
        if (!cancelled) {
          setMcpServers(servers);
          setHasAccess(servers.length > 0);
        }
      } catch {
        if (!cancelled) {
          setHasAccess(false);
          setMcpServers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAccess();
    return () => { cancelled = true; };
  }, [isAuthenticated, authLoading]);

  return { hasAccess, mcpServers, loading: authLoading || loading };
}
