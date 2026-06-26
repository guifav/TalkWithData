"use client";

import { useState, useEffect } from "react";
import { authFetch } from "@/lib/firebase/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2,
  Shield,
  Building2,
  Users,
  Settings,
  X,
  Plus,
  Database,
} from "lucide-react";
import type { Department } from "@/lib/types";

interface AccessItem {
  mcpServerId: string;
  mcpServerName: string;
  assignedDepartments: Array<{ id: string; name: string }>;
  assignedUsers: Array<{ uid: string; email: string }>;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface UserBasic {
  uid: string;
  email: string;
  displayName: string;
}

interface McpServerBasic {
  id: string;
  name: string;
}

interface McpAccessTabProps {
  departments: Department[];
  allUsers: UserBasic[];
  isSuperAdmin: boolean;
}

export function McpAccessTab({
  departments,
  allUsers,
  isSuperAdmin,
}: McpAccessTabProps) {
  const [items, setItems] = useState<AccessItem[]>([]);
  const [allServers, setAllServers] = useState<McpServerBasic[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessLoadFailed, setAccessLoadFailed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AccessItem | null>(null);
  const [editingServerId, setEditingServerId] = useState<string>("");
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setAccessLoadFailed(false);
    try {
      const [accessRes, serversRes] = await Promise.all([
        authFetch("/api/admin/mcp-access"),
        authFetch("/api/admin/mcp-servers"),
      ]);
      if (accessRes.ok) {
        const data = await accessRes.json();
        setItems(data.items || []);
      } else {
        setAccessLoadFailed(true);
      }
      if (serversRes.ok) {
        const data = await serversRes.json();
        // Only include active servers — inactive ones are ignored at runtime
        setAllServers(
          (data.servers || [])
            .filter((s: { active?: boolean }) => s.active !== false)
            .map((s: { id: string; name: string }) => ({
              id: s.id,
              name: s.name,
            }))
        );
      } else {
        setAccessLoadFailed(true);
      }
    } catch (err) {
      console.error("Failed to load MCP access data:", err);
      setAccessLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }

  function openManageDialog(item?: AccessItem) {
    if (item) {
      setEditingItem(item);
      setEditingServerId(item.mcpServerId);
      setSelectedDepts(item.assignedDepartments.map((d) => d.id));
      setSelectedUsers(item.assignedUsers.map((u) => u.uid));
    } else {
      setEditingItem(null);
      setEditingServerId("");
      setSelectedDepts([]);
      setSelectedUsers([]);
    }
    setUserSearch("");
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!editingServerId.trim()) {
      toast.error("MCP Server ID is required");
      return;
    }

    setSaving(true);
    try {
      const res = await authFetch("/api/admin/mcp-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mcpServerId: editingServerId.trim(),
          assignedDepartments: selectedDepts,
          assignedUsers: selectedUsers,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }

      toast.success("MCP access updated");
      setDialogOpen(false);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function toggleDept(deptId: string) {
    setSelectedDepts((prev) =>
      prev.includes(deptId)
        ? prev.filter((id) => id !== deptId)
        : [...prev, deptId]
    );
  }

  function toggleUser(uid: string) {
    setSelectedUsers((prev) =>
      prev.includes(uid)
        ? prev.filter((id) => id !== uid)
        : [...prev, uid]
    );
  }

  const filteredUsers = userSearch.trim()
    ? allUsers.filter(
        (u) =>
          u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
          u.displayName.toLowerCase().includes(userSearch.toLowerCase())
      )
    : [];

  // Merge: show all registered servers, filling in access data where it exists
  const itemsByServer = new Map(items.map((i) => [i.mcpServerId, i]));
  const mergedItems: AccessItem[] = allServers.map((server) => {
    const existing = itemsByServer.get(server.id);
    return existing || {
      mcpServerId: server.id,
      mcpServerName: server.name,
      assignedDepartments: [],
      assignedUsers: [],
      updatedAt: null,
      updatedBy: null,
    };
  });
  // Servers without an access rule yet (for the Add dialog dropdown)
  const unassignedServers = allServers.filter(
    (s) => !itemsByServer.has(s.id)
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (accessLoadFailed) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-destructive">Failed to load access rules. Please refresh the page.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={loadData}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="size-4" />
                MCP Access Control
              </CardTitle>
              <CardDescription>
                Manage which departments and users can access each MCP data
                source. Users with access can use the AI Dashboard Builder.
              </CardDescription>
            </div>
            {isSuperAdmin && (
              <Button size="sm" onClick={() => openManageDialog()}>
                <Plus className="size-4" />
                Add Access Rule
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {mergedItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="size-10 mx-auto opacity-20 mb-3" />
              <p className="text-sm">No MCP access rules configured yet.</p>
              <p className="text-xs mt-1">
                Add access rules to allow users to use the AI Dashboard Builder
                with specific data sources.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {mergedItems.map((item) => (
                <div
                  key={item.mcpServerId}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="size-4 text-muted-foreground" />
                      <span className="font-medium">{item.mcpServerName}</span>
                      <span className="text-xs text-muted-foreground">
                        ({item.mcpServerId})
                      </span>
                    </div>
                    {isSuperAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openManageDialog(item)}
                      >
                        <Settings className="size-3.5" />
                        Manage Access
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Building2 className="size-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      Departments:
                    </span>
                    {item.assignedDepartments.length === 0 ? (
                      <span className="text-xs text-muted-foreground italic">
                        None
                      </span>
                    ) : (
                      item.assignedDepartments.map((dept) => (
                        <Badge key={dept.id} variant="outline" className="text-xs">
                          {dept.name}
                        </Badge>
                      ))
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Users className="size-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      Users:
                    </span>
                    {item.assignedUsers.length === 0 ? (
                      <span className="text-xs text-muted-foreground italic">
                        None
                      </span>
                    ) : (
                      item.assignedUsers.map((user) => (
                        <Badge key={user.uid} variant="outline" className="text-xs">
                          {user.email}
                        </Badge>
                      ))
                    )}
                  </div>

                  {item.updatedBy && (
                    <p className="text-xs text-muted-foreground">
                      Last updated by {item.updatedBy}
                      {item.updatedAt &&
                        ` on ${new Date(item.updatedAt).toLocaleDateString()}`}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Manage Access" : "Add Access Rule"}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? `Configure access for ${editingItem.mcpServerName}`
                : "Set up access control for an MCP server"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {!editingItem && (
              <div className="space-y-2">
                <Label>MCP Server</Label>
                {unassignedServers.length > 0 ? (
                  <select
                    value={editingServerId}
                    onChange={(e) => setEditingServerId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Select a server...</option>
                    {unassignedServers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    All registered MCP servers already have access rules.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Building2 className="size-3.5" />
                Departments
              </Label>
              {departments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No departments configured yet.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {departments.map((dept) => (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() => toggleDept(dept.id)}
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                        selectedDepts.includes(dept.id)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-input hover:bg-muted"
                      }`}
                    >
                      {selectedDepts.includes(dept.id) && (
                        <X className="size-3" />
                      )}
                      {dept.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Users className="size-3.5" />
                Individual Users
              </Label>

              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedUsers.map((uid) => {
                    const user = allUsers.find((u) => u.uid === uid);
                    return (
                      <Badge
                        key={uid}
                        variant="secondary"
                        className="text-xs gap-1 cursor-pointer"
                        onClick={() => toggleUser(uid)}
                      >
                        {user?.email || uid}
                        <X className="size-3" />
                      </Badge>
                    );
                  })}
                </div>
              )}

              <Input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users by email or name..."
              />
              {filteredUsers.length > 0 && (
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  {filteredUsers
                    .filter((u) => !selectedUsers.includes(u.uid))
                    .slice(0, 10)
                    .map((user) => (
                      <button
                        key={user.uid}
                        type="button"
                        onClick={() => {
                          toggleUser(user.uid);
                          setUserSearch("");
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center justify-between"
                      >
                        <span>{user.displayName}</span>
                        <span className="text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
