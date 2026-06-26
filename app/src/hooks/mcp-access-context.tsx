"use client";

import { createContext, useContext, ReactNode } from "react";
import { useHasMcpAccess } from "@/hooks/use-mcp-access";
import type { McpServer } from "@/lib/types";

interface McpAccessContextValue {
  hasAccess: boolean;
  mcpServers: McpServer[];
  loading: boolean;
}

const McpAccessContext = createContext<McpAccessContextValue | null>(null);

/**
 * Provider that calls useHasMcpAccess() once and shares the result
 * with all descendants via context — avoids duplicate API calls.
 */
export function McpAccessProvider({ children }: { children: ReactNode }) {
  const value = useHasMcpAccess();
  return (
    <McpAccessContext.Provider value={value}>
      {children}
    </McpAccessContext.Provider>
  );
}

/**
 * Consume shared MCP access state from the layout-level provider.
 * Throws if called outside McpAccessProvider (should never happen
 * since the provider lives in RootLayout).
 */
export function useMcpAccess(): McpAccessContextValue {
  const ctx = useContext(McpAccessContext);
  if (!ctx) {
    throw new Error("useMcpAccess must be used within McpAccessProvider");
  }
  return ctx;
}
