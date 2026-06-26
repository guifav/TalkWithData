"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useMcpAccess } from "@/hooks/mcp-access-context";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { authFetch } from "@/lib/firebase/auth";
import { prepareDashboardHtmlForRender } from "@/lib/dashboard-html";
import { toast } from "sonner";
import {
  SaveDashboardDialog,
  type SaveDashboardData,
} from "@/components/save-dashboard-dialog";
import {
  Send,
  Sparkles,
  Loader2,
  Save,
  Eye,
  MessageSquare,
  ArrowLeft,
  Wrench,
  Database,
  ChevronDown,
  ToggleRight,
  ToggleLeft,
  Paperclip,
  X,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { McpSelector } from "@/components/mcp-selector";
import type { ParsedFile } from "@/lib/file-parser";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: Array<{ name: string; status: "calling" | "done" }>;
}

interface SseEvent {
  type: "text" | "tool_use" | "html" | "done" | "error";
  content?: string;
  name?: string;
  status?: "calling" | "done";
  mcpServerId?: string;
  errorType?: string;
  errorDetail?: string;
  retryable?: boolean;
  args?: Record<string, unknown>;
}

export default function CreatePage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="flex items-center justify-center h-[60vh]">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        </AppShell>
      }
    >
      <CreatePageInner />
    </Suspense>
  );
}

function CreatePageInner() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { hasAccess, mcpServers, loading: mcpLoading } = useMcpAccess();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentHtml, setCurrentHtml] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<"chat" | "preview">("chat");
  const [usedTools, setUsedTools] = useState<Array<{ tool: string; args: Record<string, unknown> }>>([]); // Track tool calls for aiRecipe
  const [selectedMcpIds, setSelectedMcpIds] = useState<string[]>([]);

  // App database state
  const [dbEnabled, setDbEnabled] = useState(false);
  const [draftDashboardId, setDraftDashboardId] = useState<string | null>(null);
  const [dbProvisioning, setDbProvisioning] = useState(false);
  const [dbLocked, setDbLocked] = useState(false); // true when DB was loaded from existing dashboard

  // File attachments
  const [attachedFiles, setAttachedFiles] = useState<ParsedFile[]>([]);
  const fileInputRef2 = useRef<HTMLInputElement>(null);

  // Edit mode state
  const [editTitle, setEditTitle] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(!!editId);
  const isEditMode = !!editId;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Default selectedMcpIds to all once loaded (only when not editing an existing dashboard,
  // which pre-seeds its own selection from aiRecipe.queries in loadDashboard)
  useEffect(() => {
    if (!mcpLoading && mcpServers.length > 0 && selectedMcpIds.length === 0 && !editId) {
      setSelectedMcpIds(mcpServers.map((s) => s.id));
    }
  }, [mcpLoading, mcpServers, editId]);

  // Auth gate
  useEffect(() => {
    if (!authLoading && !mcpLoading) {
      if (!isAuthenticated) {
        router.push("/login");
      } else if (!hasAccess) {
        router.push("/");
      }
    }
  }, [isAuthenticated, hasAccess, authLoading, mcpLoading, router]);

  // Load existing dashboard data in edit mode
  useEffect(() => {
    if (!editId || !isAuthenticated || authLoading || mcpLoading) return;

    let cancelled = false;

    async function loadDashboard() {
      try {
        // Fetch dashboard metadata
        const dashRes = await authFetch(`/api/dashboards/${editId}`);
        if (!dashRes.ok) {
          toast.error("Dashboard not found");
          router.push("/");
          return;
        }
        const dashData = await dashRes.json();

        // Verify it's an AI dashboard
        if (dashData.source !== "ai") {
          toast.error("Only AI-generated dashboards can be edited here");
          router.push("/");
          return;
        }

        if (cancelled) return;

        // Fetch conversation and HTML in parallel
        const [convRes, htmlRes] = await Promise.all([
          authFetch(`/api/dashboards/${editId}/conversation`),
          // Use ?raw=1 to skip analytics tracking (viewCount, viewed, views)
          authFetch(`/api/dashboards/${editId}/view?raw=1`),
        ]);

        if (cancelled) return;

        // Load conversation messages
        if (convRes.ok) {
          const convData = await convRes.json();
          if (convData.messages && convData.messages.length > 0) {
            const loadedMessages: ChatMessage[] = convData.messages.map(
              (m: { role: string; content: string }, i: number) => ({
                id: `edit-${i}`,
                role: m.role as "user" | "assistant",
                content: m.content,
              })
            );
            setMessages(loadedMessages);
          }
          // Restore attached files from saved conversation
          if (convData.parsedFiles && Array.isArray(convData.parsedFiles)) {
            setAttachedFiles(convData.parsedFiles);
          }
        }

        // Load current HTML
        if (htmlRes.ok) {
          const html = await htmlRes.text();
          setCurrentHtml(html);
          setActivePanel("preview");
        }

        setEditTitle(dashData.title);
        setEditDescription(dashData.description || null);

        // Seed usedTools from existing aiRecipe.queries to preserve MCP attribution on re-save.
        // Also pre-select only the MCP servers actually used by this dashboard,
        // reconciled against the user's current accessible servers.
        if (dashData.aiRecipe?.queries && Array.isArray(dashData.aiRecipe.queries)) {
          setUsedTools(dashData.aiRecipe.queries);
          const accessibleIds = new Set(mcpServers.map((s) => s.id));
          const usedMcpIds = [
            ...new Set(
              (dashData.aiRecipe.queries as Array<{ mcpServerId?: string }>)
                .map((q) => q.mcpServerId)
                .filter((id): id is string => !!id && accessibleIds.has(id))
            ),
          ];
          // If saved IDs found and still accessible, pre-select them.
          // Otherwise fall back to all accessible servers (legacy dashboards or all revoked).
          setSelectedMcpIds(usedMcpIds.length > 0 ? usedMcpIds : mcpServers.map((s) => s.id));
        } else {
          // No aiRecipe queries at all (legacy) — default to all servers
          setSelectedMcpIds(mcpServers.map((s) => s.id));
        }

        // Detect existing app-db: use Firestore summary as fast path,
        // fall back to authoritative registry check if summary is missing/stale.
        if (dashData.appDatabase?.enabled) {
          setDbEnabled(true);
          setDraftDashboardId(editId);
          setDbLocked(true);
        } else if (!cancelled) {
          // Firestore summary might be missing (best-effort write failed).
          // Check the authoritative registry as fallback.
          try {
            const dbRes = await authFetch(`/api/ai/db-context?dashboardId=${editId}`);
            if (dbRes.ok) {
              const dbData = await dbRes.json();
              if (!cancelled && dbData.hasDatabase) {
                setDbEnabled(true);
                setDraftDashboardId(editId);
                setDbLocked(true);
              }
            }
          } catch (dbErr) {
            console.error("[Edit] db-context fallback failed:", dbErr);
          }
        }
      } catch (err) {
        console.error("[Edit] Failed to load dashboard:", err);
        toast.error("Failed to load dashboard for editing");
        router.push("/");
      } finally {
        if (!cancelled) setEditLoading(false);
      }
    }

    loadDashboard();
    return () => { cancelled = true; };
  }, [editId, isAuthenticated, authLoading, mcpLoading, router]);

  // File attachment handler (server-side parsing)
  const handleFileAttach = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large. Maximum 10MB.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await authFetch("/api/ai/parse-file", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Parse failed" }));
        throw new Error(err.error || "Failed to parse file");
      }
      const parsed: ParsedFile = await res.json();
      setAttachedFiles((prev) => [...prev, parsed]);
      if (parsed.truncated) {
        toast.info(`File truncated to ${(parsed.content.length / 1024).toFixed(0)}KB`);
      }
      toast.success(`${file.name} attached`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to parse file");
    }
  }, []);

  const removeAttachedFile = useCallback((index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Toggle handler for app-db
  const handleDbToggle = useCallback(async () => {
    if (dbLocked) return; // DB already exists on this dashboard — can't toggle off
    if (dbEnabled) {
      // Disable: clear draft (cleanup job will handle it)
      setDbEnabled(false);
      setDraftDashboardId(null);
      return;
    }
    // Enable: provision a draft
    setDbProvisioning(true);
    try {
      const res = await authFetch("/api/ai/provision-draft", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to provision database" }));
        throw new Error(err.error || "Failed to provision database");
      }
      const data = await res.json();
      setDraftDashboardId(data.dashboardId);
      setDbEnabled(true);
      toast.success("Database enabled for this app");
    } catch (err) {
      console.error("[DB Toggle] Provision failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to enable database");
    } finally {
      setDbProvisioning(false);
    }
  }, [dbEnabled, dbLocked]);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!input.trim() || isGenerating || dbProvisioning) return;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: input.trim(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsGenerating(true);

      // Build messages payload for API
      // Include current HTML so follow-ups refine the existing dashboard
      const apiMessages = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: userMessage.content },
      ];

      try {
        const res = await authFetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            mcpServerIds: selectedMcpIds.length > 0 ? selectedMcpIds : mcpServers.map((s) => s.id),
            ...(currentHtml ? { currentHtml } : {}),
            ...(draftDashboardId ? { draftDashboardId } : {}),
            ...(attachedFiles.length > 0 ? { attachedFiles: attachedFiles.map((f) => ({ name: f.name, type: f.type, summary: f.summary, content: f.content })) } : {}),
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Request failed" }));
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let assistantText = "";
        const toolCalls: ChatMessage["toolCalls"] = [];
        let buffer = "";

        // Create assistant message placeholder
        const assistantId = crypto.randomUUID();
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: "", toolCalls: [] },
        ]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE lines
          const lines = buffer.split("\n");
          // Keep incomplete last line in buffer
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            let event: SseEvent;
            try {
              event = JSON.parse(jsonStr);
            } catch {
              continue;
            }

            switch (event.type) {
              case "text":
                assistantText += event.content || "";
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: assistantText, toolCalls: [...toolCalls] }
                      : m
                  )
                );
                break;

              case "tool_use":
                if (event.status === "calling") {
                  toolCalls.push({
                    name: event.name || "unknown",
                    status: "calling",
                  });
                  // Track for aiRecipe.queries — include mcpServerId and real args for attribution
                  setUsedTools((prev) => [
                    ...prev,
                    {
                      tool: event.name || "unknown",
                      args: event.args ?? {},
                      ...(event.mcpServerId ? { mcpServerId: event.mcpServerId } : {}),
                    },
                  ]);
                } else if (event.status === "done") {
                  const tc = toolCalls.find(
                    (t) => t.name === event.name && t.status === "calling"
                  );
                  if (tc) tc.status = "done";
                }
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, toolCalls: [...toolCalls] }
                      : m
                  )
                );
                break;

              case "html":
                setCurrentHtml(event.content || null);
                // Auto-switch to preview on mobile
                setActivePanel("preview");
                break;

              case "error":
                toast.error(event.content || "An error occurred");
                break;

              case "done":
                break;
            }
          }
        }
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "Failed to generate";
        toast.error(msg);
        // Remove empty assistant message on error
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && !last.content) {
            return prev.slice(0, -1);
          }
          return prev;
        });
      } finally {
        setIsGenerating(false);
        inputRef.current?.focus();
      }
    },
    [input, isGenerating, dbProvisioning, messages, mcpServers, selectedMcpIds, draftDashboardId, attachedFiles]
  );

  const handleSaveClick = useCallback(() => {
    if (!currentHtml) return;
    if (isEditMode) {
      // Edit mode: save directly with existing metadata
      handleSaveWithData({
        title: editTitle || "Untitled",
        description: editDescription || "",
        category: "Other",
        visibility: "team",
        allowedEmails: [],
      });
    } else {
      setSaveDialogOpen(true);
    }
  }, [currentHtml, isEditMode, editTitle, editDescription]);

  const handleSaveWithData = useCallback(async (data: SaveDashboardData) => {
    if (!currentHtml) return;

    setIsSaving(true);
    setSaveDialogOpen(false);
    try {
      const res = await authFetch("/api/ai/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isEditMode ? { dashboardId: editId } : {}),
          ...(draftDashboardId ? { draftDashboardId } : {}),
          title: data.title,
          description: data.description || "",
          html: currentHtml,
          category: data.category,
          visibility: data.visibility,
          allowedEmails: data.allowedEmails,
          aiRecipe: {
            queries: usedTools,
            generationPrompt:
              messages.find((m) => m.role === "user")?.content || "",
            lastRefreshedAt: new Date().toISOString(),
            refreshSchedule: "manual",
            staleAfterHours: 168,
            ...(attachedFiles.length > 0 ? { uploads: attachedFiles.map((f) => ({ name: f.name, type: f.type, parsedChars: f.content.length })) } : {}),
          },
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          ...(attachedFiles.length > 0 ? { parsedFiles: attachedFiles } : {}),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Save failed" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data2 = await res.json();
      toast.success(isEditMode ? "Dashboard updated!" : "Dashboard saved!");
      router.push(`/view/${data2.slug || data2.id}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Save failed";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  }, [currentHtml, messages, router, isEditMode, editId, draftDashboardId]);

  if (authLoading || mcpLoading || editLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
              <ArrowLeft className="size-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="size-5" />
                {isEditMode && editTitle
                  ? `Editing: ${editTitle}`
                  : "AI Dashboard Builder"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isEditMode
                  ? "Continue the conversation to refine your dashboard"
                  : "Describe the dashboard you want and AI will build it with real data"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Mobile panel toggle */}
            <div className="flex lg:hidden">
              <Button
                variant={activePanel === "chat" ? "default" : "outline"}
                size="sm"
                onClick={() => setActivePanel("chat")}
              >
                <MessageSquare className="size-4" />
              </Button>
              <Button
                variant={activePanel === "preview" ? "default" : "outline"}
                size="sm"
                onClick={() => setActivePanel("preview")}
                disabled={!currentHtml}
              >
                <Eye className="size-4" />
              </Button>
            </div>
            {currentHtml && (
              <Button onClick={handleSaveClick} disabled={isSaving || dbProvisioning} size="sm">
                {isSaving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                {isEditMode ? "Update Dashboard" : "Save Dashboard"}
              </Button>
            )}
          </div>
        </div>

        {/* Split View */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-12rem)]">
          {/* Chat Panel */}
          <Card
            className={`flex flex-col overflow-hidden ${
              activePanel !== "chat" ? "hidden lg:flex" : "flex"
            }`}
          >
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm space-y-3">
                  <Sparkles className="size-12 opacity-20" />
                  {mcpServers.length === 0 ? (
                    <p className="text-center max-w-sm">
                      No data sources assigned to you. Contact your admin.
                    </p>
                  ) : (
                  <p className="text-center max-w-sm">
                    Describe the dashboard you want. For example:
                  </p>
                  )}
                  {mcpServers.length > 0 && (
                  <div className="space-y-2 text-xs">
                    <p className="bg-muted rounded-lg px-3 py-2">
                      &ldquo;Create a sales pipeline dashboard showing deals by
                      stage and revenue trends&rdquo;
                    </p>
                    <p className="bg-muted rounded-lg px-3 py-2">
                      &ldquo;Show me CS metrics: NRR, churn risk, and health
                      scores&rdquo;
                    </p>
                    <p className="bg-muted rounded-lg px-3 py-2">
                      &ldquo;Build an event participation analysis for
                      2024&rdquo;
                    </p>
                  </div>
                  )}
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {/* Tool call indicators */}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {msg.toolCalls.map((tc, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="text-xs gap-1"
                          >
                            {tc.status === "calling" ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Wrench className="size-3" />
                            )}
                            {tc.name.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              ))}

              {isGenerating &&
                messages[messages.length - 1]?.role !== "assistant" && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-4 py-2.5">
                      <Loader2 className="size-4 animate-spin" />
                    </div>
                  </div>
                )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t p-3 space-y-2">
              <div className="flex items-center gap-3">
                <McpSelector
                  mcpServers={mcpServers}
                  selectedIds={selectedMcpIds}
                  onSelectionChange={setSelectedMcpIds}
                />
                <button
                  type="button"
                  onClick={handleDbToggle}
                  disabled={dbProvisioning || isGenerating || dbLocked}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    dbEnabled
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  } ${dbProvisioning ? "opacity-50 cursor-wait" : dbLocked ? "cursor-default" : "cursor-pointer"}`}
                  title={dbLocked ? "Database is active on this dashboard" : "Enable persistent database. The AI agent can create tables and save data."}
                >
                  {dbProvisioning ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Database className="size-3" />
                  )}
                  {dbLocked ? "Database Active" : dbEnabled ? "Database On" : "Database"}
                </button>
              </div>
            {/* Attached files chips */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-1">
                {attachedFiles.map((f, i) => (
                  <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-xs">
                    {f.type === "xlsx" ? <FileSpreadsheet className="size-3" /> : <FileText className="size-3" />}
                    {f.name}
                    <button type="button" onClick={() => removeAttachedFile(i)} className="ml-0.5 hover:text-destructive">
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2"
            >
              <input
                ref={fileInputRef2}
                type="file"
                accept=".xlsx,.md,.markdown"
                onChange={handleFileAttach}
                className="hidden"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef2.current?.click()}
                disabled={isGenerating}
                title="Attach .xlsx or .md file"
              >
                <Paperclip className="size-4" />
              </Button>
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe the dashboard you want..."
                disabled={isGenerating}
                autoFocus
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isGenerating || dbProvisioning}
              >
                {isGenerating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </form>
            </div>
          </Card>

          {/* Preview Panel */}
          <Card
            className={`flex flex-col overflow-hidden ${
              activePanel !== "preview" ? "hidden lg:flex" : "flex"
            }`}
          >
            {currentHtml ? (
              <iframe
                srcDoc={(() => {
                  let html = prepareDashboardHtmlForRender(currentHtml);
                  // Inject data API bootstrap for preview (read-only: no session cookie in srcDoc iframe)
                  if (draftDashboardId) {
                    const bootstrap = `<script>window.__DASHS_DASHBOARD_ID__="${draftDashboardId}";window.__DASHS_DATA_API__="/api/dashboards/${draftDashboardId}/data";window.__DASHS_PREVIEW__=true;</script>`;
                    if (/<head[^>]*>/i.test(html)) {
                      html = html.replace(/(<head[^>]*>)/i, `$1\n${bootstrap}`);
                    } else {
                      html = `${bootstrap}\n${html}`;
                    }
                  }
                  return html;
                })()}
                className="flex-1 w-full border-0"
                title="Dashboard Preview"
                sandbox="allow-scripts"
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                <div className="text-center space-y-2">
                  <Eye className="size-12 mx-auto opacity-20" />
                  <p>Dashboard preview will appear here</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
      <SaveDashboardDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        onSave={handleSaveWithData}
        saving={isSaving}
        defaultTitle={messages.find((m) => m.role === "user")?.content?.slice(0, 60) || ""}
      />
    </AppShell>
  );
}
