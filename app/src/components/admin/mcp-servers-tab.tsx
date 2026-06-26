"use client";

import { useEffect, useState, useCallback } from "react";
import { authFetch } from "@/lib/firebase/auth";
import type { McpServer } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus,
  RefreshCw,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronRight,
  Sprout,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface McpServerStat {
  mcpServerId: string;
  dashboardCount: number;
  userCount: number;
  dashboards: Array<{ id: string; title: string; createdByEmail: string }>;
}

interface McpServersTabProps {
  isSuperAdmin: boolean;
}

function formatSyncDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function McpServersTab({ isSuperAdmin }: McpServersTabProps) {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [syncAllLoading, setSyncAllLoading] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [stats, setStats] = useState<Map<string, McpServerStat>>(new Map());
  const [editServer, setEditServer] = useState<McpServer | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    endpoint: "",
    requiredScope: "",
  });

  const fetchServers = useCallback(async () => {
    try {
      const [serversRes, statsRes] = await Promise.all([
        authFetch("/api/admin/mcp-servers"),
        authFetch("/api/admin/mcp-stats"),
      ]);
      if (serversRes.ok) {
        const data = await serversRes.json();
        setServers(data.servers || []);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        const map = new Map<string, McpServerStat>();
        for (const s of data.stats || []) {
          map.set(s.mcpServerId, s);
        }
        setStats(map);
      }
    } catch (err) {
      console.error("Failed to fetch MCP servers:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  const handleSeed = async () => {
    setSeedLoading(true);
    try {
      const res = await authFetch("/api/admin/mcp-servers/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to seed");
      }
      const data = await res.json();
      toast.success(data.message);
      await fetchServers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Seed failed");
    } finally {
      setSeedLoading(false);
    }
  };

  const handleSyncAll = async () => {
    setSyncAllLoading(true);
    try {
      const res = await authFetch("/api/admin/mcp-servers/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to sync");
      }
      const data = await res.json();
      const errors = data.synced?.filter(
        (s: { error?: string }) => s.error
      ).length;
      toast.success(
        `Synced ${data.synced?.length || 0} servers${errors ? ` (${errors} with errors)` : ""}`
      );
      await fetchServers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncAllLoading(false);
    }
  };

  const handleSyncOne = async (id: string) => {
    setSyncingIds((prev) => new Set(prev).add(id));
    try {
      const res = await authFetch("/api/admin/mcp-servers/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to sync");
      }
      const data = await res.json();
      const result = data.synced?.[0];
      if (result?.error) {
        toast.error(`Sync error: ${result.error}`);
      } else {
        toast.success(
          `${result?.name}: ${result?.toolCount} tools discovered`
        );
      }
      await fetchServers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleToggleActive = async (server: McpServer) => {
    try {
      const res = await authFetch("/api/admin/mcp-servers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: server.id, active: !server.active }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }
      toast.success(
        `${server.name} ${server.active ? "deactivated" : "activated"}`
      );
      await fetchServers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle");
    }
  };

  const handleDelete = async (server: McpServer) => {
    if (!confirm(`Delete "${server.name}"? This cannot be undone.`)) return;
    try {
      const res = await authFetch("/api/admin/mcp-servers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: server.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }
      toast.success(`Deleted "${server.name}"`);
      await fetchServers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleRegister = async () => {
    try {
      const res = await authFetch("/api/admin/mcp-servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }
      toast.success(`Registered "${formData.name}"`);
      setRegisterOpen(false);
      setFormData({ name: "", description: "", endpoint: "", requiredScope: "" });
      await fetchServers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    }
  };

  const handleEdit = async () => {
    if (!editServer) return;
    try {
      const res = await authFetch("/api/admin/mcp-servers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editServer.id, ...formData }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }
      toast.success(`Updated "${formData.name}"`);
      setEditServer(null);
      setFormData({ name: "", description: "", endpoint: "", requiredScope: "" });
      await fetchServers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  const openEditDialog = (server: McpServer) => {
    setFormData({
      name: server.name,
      description: server.description,
      endpoint: server.endpoint,
      requiredScope: server.requiredScope,
    });
    setEditServer(server);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header actions */}
      {isSuperAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeed}
            disabled={seedLoading}
          >
            {seedLoading ? (
              <Loader2 className="size-4 mr-1 animate-spin" />
            ) : (
              <Sprout className="size-4 mr-1" />
            )}
            Seed Culkin MCPs
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncAll}
            disabled={syncAllLoading}
          >
            {syncAllLoading ? (
              <Loader2 className="size-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="size-4 mr-1" />
            )}
            Sync All
          </Button>
          <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                onClick={() =>
                  setFormData({
                    name: "",
                    description: "",
                    endpoint: "",
                    requiredScope: "",
                  })
                }
              >
                <Plus className="size-4 mr-1" />
                Register MCP
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Register MCP Server</DialogTitle>
                <DialogDescription>
                  Add a new MCP server endpoint to the registry.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-name">Name</Label>
                  <Input
                    id="reg-name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="Analytics"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-desc">Description</Label>
                  <Input
                    id="reg-desc"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, description: e.target.value }))
                    }
                    placeholder="What this MCP covers..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-endpoint">Endpoint URL</Label>
                  <Input
                    id="reg-endpoint"
                    value={formData.endpoint}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, endpoint: e.target.value }))
                    }
                    placeholder="https://culkin.mygri.com/api/mcp/..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-scope">Required Scope</Label>
                  <Input
                    id="reg-scope"
                    value={formData.requiredScope}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        requiredScope: e.target.value,
                      }))
                    }
                    placeholder="mcp:analytics"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setRegisterOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRegister}
                  disabled={!formData.name || !formData.endpoint || !formData.requiredScope}
                >
                  Register
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Server list */}
      {servers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>No MCP servers registered yet.</p>
            {isSuperAdmin && (
              <p className="mt-2 text-sm">
                Click &quot;Seed Culkin MCPs&quot; to populate with known
                endpoints.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {servers.map((server) => {
            const isExpanded = expandedId === server.id;
            const isSyncing = syncingIds.has(server.id);

            return (
              <Card
                key={server.id}
                className={!server.active ? "opacity-60" : undefined}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        {server.name}
                        <Badge variant={server.active ? "default" : "secondary"}>
                          {server.active ? "Active" : "Inactive"}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-1 line-clamp-2">
                        {server.description}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {server.toolCount > 0 && (
                        <Badge variant="outline">
                          {server.toolCount} tools
                        </Badge>
                      )}
                      {(stats.get(server.id)?.dashboardCount ?? 0) > 0 && (
                        <Badge variant="secondary">
                          {stats.get(server.id)!.dashboardCount} dashboard{stats.get(server.id)!.dashboardCount !== 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <ExternalLink className="size-3" />
                      <span className="truncate font-mono text-xs">
                        {server.endpoint}
                      </span>
                    </div>
                    <div className="text-muted-foreground text-xs">
                      Scope: <code>{server.requiredScope}</code>
                    </div>
                    <div className="text-muted-foreground text-xs">
                      Last synced: {formatSyncDate(server.lastSyncedAt)}
                    </div>
                    {(stats.get(server.id)?.userCount ?? 0) > 0 && (
                      <div className="text-muted-foreground text-xs">
                        Used by {stats.get(server.id)!.userCount} user{stats.get(server.id)!.userCount !== 1 ? "s" : ""}
                      </div>
                    )}
                    {server.lastSyncError && (
                      <div className="text-destructive text-xs truncate">
                        Error: {server.lastSyncError}
                      </div>
                    )}
                  </div>

                  {/* Tools expand/collapse */}
                  {server.tools.length > 0 && (
                    <div>
                      <button
                        onClick={() =>
                          setExpandedId(isExpanded ? null : server.id)
                        }
                        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                        {server.tools.length} tool
                        {server.tools.length !== 1 ? "s" : ""}
                      </button>
                      {isExpanded && (
                        <div className="mt-2 max-h-60 overflow-y-auto space-y-1.5 pl-1">
                          {server.tools.map((tool) => (
                            <div
                              key={tool.name}
                              className="text-xs border-l-2 border-muted pl-2 py-0.5"
                            >
                              <span className="font-medium font-mono">
                                {tool.name}
                              </span>
                              {tool.description && (
                                <p className="text-muted-foreground mt-0.5 line-clamp-2">
                                  {tool.description}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  {isSuperAdmin && (
                    <div className="flex flex-wrap items-center gap-1 pt-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(server)}
                      >
                        <Pencil className="size-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSyncOne(server.id)}
                        disabled={isSyncing}
                      >
                        {isSyncing ? (
                          <Loader2 className="size-3.5 mr-1 animate-spin" />
                        ) : (
                          <RefreshCw className="size-3.5 mr-1" />
                        )}
                        Sync
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(server)}
                      >
                        {server.active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(server)}
                      >
                        <Trash2 className="size-3.5 mr-1" />
                        Delete
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog
        open={editServer !== null}
        onOpenChange={(open) => {
          if (!open) setEditServer(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit MCP Server</DialogTitle>
            <DialogDescription>
              Update the MCP server configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Input
                id="edit-desc"
                value={formData.description}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, description: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-endpoint">Endpoint URL</Label>
              <Input
                id="edit-endpoint"
                value={formData.endpoint}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, endpoint: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-scope">Required Scope</Label>
              <Input
                id="edit-scope"
                value={formData.requiredScope}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, requiredScope: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditServer(null)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={!formData.name || !formData.endpoint || !formData.requiredScope}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
