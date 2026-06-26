"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useMcpAccess } from "@/hooks/mcp-access-context";
import { authFetch } from "@/lib/firebase/auth";
import { toast } from "sonner";
import { LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { ChatSidebar, type ChatSession } from "@/components/chat/chat-sidebar";
import {
  ChatMessages,
  type ChatMessage,
} from "@/components/chat/chat-messages";
import { ChatInput } from "@/components/chat/chat-input";
import { McpSelector } from "@/components/mcp-selector";
import {
  SaveDashboardDialog,
  type SaveDashboardData,
} from "@/components/save-dashboard-dialog";

function ChatPageInner() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { hasAccess, mcpServers, loading: mcpLoading } = useMcpAccess();
  const router = useRouter();
  const searchParams = useSearchParams();


  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, _setActiveSessionId] = useState<string | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  const setActiveSessionId = useCallback((id: string | null) => {
    activeSessionIdRef.current = id;
    _setActiveSessionId(id);
  }, []);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [activeToolCalls, setActiveToolCalls] = useState<
    Array<{ name: string; status: string }>
  >([]);
  const [currentHtml, setCurrentHtml] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [isSavingDashboard, setIsSavingDashboard] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedMcpIds, _setSelectedMcpIds] = useState<string[]>([]);
  const selectedMcpIdsRef = useRef<string[]>([]);
  // Wrapper that keeps ref in sync synchronously — avoids stale reads
  // from saveToSession when selection changes during streaming
  const setSelectedMcpIds = useCallback((ids: string[]) => {
    selectedMcpIdsRef.current = ids;
    _setSelectedMcpIds(ids);
  }, []);
  // Track whether selectedMcpIds has been explicitly initialised for the current session
  const mcpIdsInitialisedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  // Track accumulated tool calls during a generation cycle
  const accToolCallsRef = useRef<Array<{ name: string; status: string }>>([]);
  const usedToolsRef = useRef<Array<{ tool: string; args: Record<string, unknown>; mcpServerId?: string }>>([]);

  // Default selectedMcpIds — respect ?mcp= param from Explore page
  useEffect(() => {
    if (!mcpLoading && mcpServers.length > 0 && !mcpIdsInitialisedRef.current) {
      const mcpParam = searchParams.get("mcp");
      if (mcpParam && mcpServers.some((s) => s.id === mcpParam)) {
        setSelectedMcpIds([mcpParam]);
      } else {
        setSelectedMcpIds(mcpServers.map((s) => s.id));
      }
      mcpIdsInitialisedRef.current = true;
    }
  }, [mcpLoading, mcpServers, searchParams]);

  // Auth gate
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!mcpLoading && !hasAccess && isAuthenticated) {
      router.push("/");
    }
  }, [mcpLoading, hasAccess, isAuthenticated, router]);

  // Load sessions
  const loadSessions = useCallback(async () => {
    try {
      const res = await authFetch("/api/chat-sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && hasAccess) {
      loadSessions();
    }
  }, [isAuthenticated, hasAccess, loadSessions]);

  // Create new session
  const handleNewChat = useCallback(async () => {
    // Abort any in-flight generation
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setIsGenerating(false);
    }
    // Invalidate pending session loads + clear loading state
    sessionLoadRef.current++;
    setIsLoadingSession(false);
    setActiveSessionId(null);
    setMessages([]);
    setCurrentHtml(null);
    setStreamingText("");
    setActiveToolCalls([]);
    usedToolsRef.current = [];
    setSelectedMcpIds(mcpServers.map((s) => s.id));
    pendingMcpIdsRef.current = null;
  }, [setActiveSessionId, mcpServers]);

  // Load session messages — guard against stale responses from rapid switching
  const sessionLoadRef = useRef(0);
  const handleSelectSession = useCallback(
    async (sessionId: string) => {
      if (sessionId === activeSessionId) return;
      // Abort any in-flight generation before switching
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
        setIsGenerating(false);
      }
      const prevSessionId = activeSessionId;
      const prevMessages = messages;
      const prevUsedTools = [...usedToolsRef.current];
      const loadId = ++sessionLoadRef.current;
      setIsLoadingSession(true);
      setActiveSessionId(sessionId);
      pendingMcpIdsRef.current = null;
      setMessages([]);
      setCurrentHtml(null);
      setStreamingText("");
      setActiveToolCalls([]);
      usedToolsRef.current = [];

      try {
        const res = await authFetch(`/api/chat-sessions/${sessionId}`);
        if (loadId !== sessionLoadRef.current) return;
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
          if (data.usedTools && Array.isArray(data.usedTools)) {
            usedToolsRef.current = data.usedTools;
          }
          // Restore MCP selection from session, reconciled against current access
          const accessibleIds = new Set(mcpServers.map((s) => s.id));
          if (data.selectedMcpIds && Array.isArray(data.selectedMcpIds)) {
            const valid = (data.selectedMcpIds as string[]).filter((id) => accessibleIds.has(id));
            setSelectedMcpIds(valid.length > 0 ? valid : mcpServers.map((s) => s.id));
          } else {
            setSelectedMcpIds(mcpServers.map((s) => s.id));
          }
        } else {
          toast.error("Failed to load conversation");
          setActiveSessionId(prevSessionId);
          setMessages(prevMessages);
          usedToolsRef.current = prevUsedTools;
        }
      } catch {
        if (loadId === sessionLoadRef.current) {
          toast.error("Failed to load conversation");
          setActiveSessionId(prevSessionId);
          setMessages(prevMessages);
          usedToolsRef.current = prevUsedTools;
        }
      } finally {
        if (loadId === sessionLoadRef.current) {
          setIsLoadingSession(false);
        }
      }
    },
    [activeSessionId, messages, setActiveSessionId, mcpServers]
  );

  // Delete session
  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      try {
        const res = await authFetch("/api/chat-sessions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        if (res.ok) {
          setSessions((prev) => prev.filter((s) => s.id !== sessionId));
          if (activeSessionId === sessionId) {
            // Same cleanup as handleNewChat: invalidate pending loads
            sessionLoadRef.current++;
            setIsLoadingSession(false);
            if (abortRef.current) {
              abortRef.current.abort();
              abortRef.current = null;
              setIsGenerating(false);
            }
            setActiveSessionId(null);
            setMessages([]);
            setCurrentHtml(null);
            setStreamingText("");
            setActiveToolCalls([]);
            usedToolsRef.current = [];
            setSelectedMcpIds(mcpServers.map((s) => s.id));
            pendingMcpIdsRef.current = null;
          }
          toast.success("Conversation deleted");
        }
      } catch {
        toast.error("Failed to delete conversation");
      }
    },
    [activeSessionId, mcpServers]
  );

  // Save messages to session (auto-save)
  const saveToSession = useCallback(
    async (sessionId: string, msgs: ChatMessage[], title?: string) => {
      try {
        // Read from ref to always get the latest selection (avoids
        // stale closure when user changes selector during streaming)
        const currentMcpIds = selectedMcpIdsRef.current;
        const body: Record<string, unknown> = {
          messages: msgs,
          mcpServerIds: currentMcpIds.length > 0 ? currentMcpIds : mcpServers.map((s) => s.id),
          usedTools: usedToolsRef.current,
          selectedMcpIds: currentMcpIds,
        };
        if (title) body.title = title;

        await authFetch(`/api/chat-sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch {
        // silent — auto-save failure shouldn't block user
      }
    },
    [mcpServers]
  );

  // Per-session serialized MCP persistence — writes to the same session
  // are chained in order; different sessions proceed independently.
  const mcpPatchChainsRef = useRef<Map<string, Promise<void>>>(new Map());
  const pendingMcpIdsRef = useRef<string[] | null>(null);

  const persistMcpSelection = useCallback(
    (ids: string[], sessionId: string | null) => {
      if (!sessionId) {
        pendingMcpIdsRef.current = ids;
        return;
      }
      pendingMcpIdsRef.current = null;
      const chains = mcpPatchChainsRef.current;
      const prev = chains.get(sessionId) ?? Promise.resolve();
      const next = prev
        .then(() =>
          authFetch(`/api/chat-sessions/${sessionId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ selectedMcpIds: ids }),
          })
        )
        .then(() => {})
        .catch(() => { /* silent */ })
        .finally(() => {
          // Clean up entry when chain settles to avoid unbounded growth
          if (chains.get(sessionId) === next) chains.delete(sessionId);
        });
      chains.set(sessionId, next);
    },
    []
  );

  const handleMcpSelectionChange = useCallback(
    (ids: string[]) => {
      setSelectedMcpIds(ids);
      persistMcpSelection(ids, activeSessionIdRef.current);
    },
    [persistMcpSelection]
  );

  // Send message
  const handleSend = useCallback(
    async (userMessage: string) => {
      if (isGenerating || isLoadingSession) return;

      // Snapshot MCP selection at send time — immune to selector
      // changes during the async session-create + streaming window
      const sendMcpIds = [...selectedMcpIdsRef.current];

      let sessionId = activeSessionId;

      // Create session if needed
      if (!sessionId) {
        try {
          const title = userMessage.slice(0, 50);
          const res = await authFetch("/api/chat-sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, selectedMcpIds: sendMcpIds }),
          });
          if (res.ok) {
            const data = await res.json();
            sessionId = data.id;
            setActiveSessionId(sessionId);
            setSessions((prev) => [
              { id: data.id, title: data.title, updatedAt: new Date().toISOString(), messageCount: 0 },
              ...prev,
            ]);
            // Flush any MCP selection changes that arrived while POST was in flight
            if (pendingMcpIdsRef.current) {
              persistMcpSelection(pendingMcpIdsRef.current, data.id);
            }
          }
        } catch {
          toast.error("Failed to create conversation");
          return;
        }
      }

      const userMsg: ChatMessage = {
        role: "user",
        content: userMessage,
        timestamp: new Date().toISOString(),
      };

      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setIsGenerating(true);
      setStreamingText("");
      setActiveToolCalls([]);
      setCurrentHtml(null);
      accToolCallsRef.current = [];

      const abortController = new AbortController();
      abortRef.current = abortController;
      // Capture session ID at send time — used to ignore finalization if user switched
      const sendSessionId = sessionId;

      try {
        // Build messages for API (just role + content, no metadata)
        const apiMessages = newMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await authFetch("/api/ai/data-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            mcpServerIds: sendMcpIds.length > 0 ? sendMcpIds : mcpServers.map((s) => s.id),
            sessionId,
          }),
          signal: abortController.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Request failed" }));
          toast.error(err.error || "Failed to send message");
          setIsGenerating(false);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          setIsGenerating(false);
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";
        let htmlContent: string | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const event = JSON.parse(jsonStr);

              if (event.type === "text") {
                fullText += event.content;
                setStreamingText(fullText);
              } else if (event.type === "html") {
                htmlContent = event.content;
                setCurrentHtml(event.content);
              } else if (event.type === "tool_use") {
                const tc = { name: event.name, status: event.status };
                if (event.status === "calling") {
                  accToolCallsRef.current = [...accToolCallsRef.current, tc];
                  // Track for aiRecipe.queries with mcpServerId
                  usedToolsRef.current = [
                    ...usedToolsRef.current,
                    { tool: event.name, args: event.args ?? {}, ...(event.mcpServerId ? { mcpServerId: event.mcpServerId } : {}) },
                  ];
                } else if (event.status === "done") {
                  accToolCallsRef.current = accToolCallsRef.current.map((t) =>
                    t.name === event.name && t.status === "calling"
                      ? { ...t, status: "done" }
                      : t
                  );
                }
                setActiveToolCalls([...accToolCallsRef.current]);
              } else if (event.type === "error") {
                toast.error(event.content);
              }
            } catch {
              // skip malformed SSE
            }
          }
        }

        // Finalize assistant message — only if still on the same session
        // Use ref (not closure) so newly-created sessions are visible
        if ((fullText || accToolCallsRef.current.length > 0) && sendSessionId === activeSessionIdRef.current) {
          const assistantMsg: ChatMessage = {
            role: "assistant",
            content: fullText,
            toolCalls:
              accToolCallsRef.current.length > 0
                ? accToolCallsRef.current
                : undefined,
            timestamp: new Date().toISOString(),
          };

          const finalMessages = [...newMessages, assistantMsg];
          setMessages(finalMessages);

          // Auto-save to the ORIGINAL session (sendSessionId), not activeSessionId
          if (sendSessionId) {
            saveToSession(sendSessionId, finalMessages);
            setSessions((prev) =>
              prev.map((s) =>
                s.id === sendSessionId
                  ? {
                      ...s,
                      updatedAt: new Date().toISOString(),
                      messageCount: finalMessages.length,
                    }
                  : s
              )
            );
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          toast.error("Connection error");
        }
      } finally {
        setIsGenerating(false);
        setStreamingText("");
        setActiveToolCalls([]);
        abortRef.current = null;
      }
    },
    [messages, isGenerating, activeSessionId, mcpServers, saveToSession, persistMcpSelection]
  );

  // Stop generation
  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Save dashboard from chat
  const handleSaveDashboardClick = useCallback(() => {
    if (!currentHtml) return;
    setSaveDialogOpen(true);
  }, [currentHtml]);

  const handleSaveDashboardConfirm = useCallback(async (data: SaveDashboardData) => {
    if (!currentHtml) return;
    setIsSavingDashboard(true);
    setSaveDialogOpen(false);
    try {
      const res = await authFetch("/api/ai/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: currentHtml,
          title: data.title,
          description: data.description || "",
          category: data.category,
          visibility: data.visibility,
          allowedEmails: data.allowedEmails,
          aiRecipe: {
            queries: usedToolsRef.current.filter((q) => q.tool !== "save_dashboard_html"),
            generationPrompt: messages.find((m) => m.role === "user")?.content || "",
            lastRefreshedAt: new Date().toISOString(),
            refreshSchedule: "manual",
            staleAfterHours: 168,
          },
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (res.ok) {
        const data2 = await res.json();
        toast.success("Dashboard saved!", {
          action: {
            label: "View",
            onClick: () => router.push(`/view/${data2.slug || data2.id}`),
          },
        });
      } else {
        const err = await res.json().catch(() => ({ error: "Save failed" }));
        toast.error(err.error || "Failed to save dashboard");
      }
    } catch {
      toast.error("Failed to save dashboard");
    } finally {
      setIsSavingDashboard(false);
    }
  }, [currentHtml, messages, router]);

  if (authLoading || mcpLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <LayoutDashboard className="size-5" />
          <span className="text-lg font-semibold">GRI Dashboards</span>
          <span className="text-xs text-muted-foreground ml-1">/ Chat</span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <ChatSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          onNewChat={handleNewChat}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
        />
        <div className="flex flex-1 flex-col min-w-0">
          <ChatMessages
            messages={messages}
            isGenerating={isGenerating}
            streamingText={streamingText}
            activeToolCalls={activeToolCalls}
            currentHtml={currentHtml}
            onSaveDashboard={handleSaveDashboardClick}
          />
          <ChatInput
            onSend={handleSend}
            onStop={handleStop}
            isGenerating={isGenerating}
            disabled={isLoadingSession}
            headerSlot={
              <McpSelector
                mcpServers={mcpServers}
                selectedIds={selectedMcpIds}
                onSelectionChange={handleMcpSelectionChange}
              />
            }
          />
        </div>
      </div>
      <SaveDashboardDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        onSave={handleSaveDashboardConfirm}
        saving={isSavingDashboard}
        defaultTitle={messages.find((m) => m.role === "user")?.content?.slice(0, 60) || ""}
      />
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatPageInner />
    </Suspense>
  );
}
