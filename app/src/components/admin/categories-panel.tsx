"use client";

import { useState } from "react";
import { authFetch } from "@/lib/firebase/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Pencil, Trash2, Plus, Check, X, Shield } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// ---- Departments Panel ----

export function DepartmentsPanel({
  departments,
  deptCounts,
  onUpdate,
}: {
  departments: string[];
  deptCounts: Record<string, number>;
  onUpdate: (updated: string[]) => void;
}) {
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const res = await authFetch("/api/admin/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", name }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }
      const data = await res.json();
      onUpdate(data.categories);
      setNewName("");
      toast.success(`Added "${name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async (oldName: string) => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === oldName) {
      setEditingName(null);
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch("/api/admin/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rename", name: oldName, newName: trimmed }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }
      const data = await res.json();
      onUpdate(data.categories);
      setEditingName(null);
      toast.success(`Renamed to "${trimmed}" (${data.dashboardsUpdated} dashboards updated)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rename");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (name: string) => {
    const count = deptCounts[name] || 0;
    const msg = count > 0
      ? `Remove "${name}"? ${count} dashboard${count > 1 ? "s" : ""} will be reclassified to "Other".`
      : `Remove "${name}"?`;
    if (!confirm(msg)) return;

    setSaving(true);
    try {
      const res = await authFetch("/api/admin/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", name }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }
      const data = await res.json();
      onUpdate(data.categories);
      toast.success(
        data.dashboardsReclassified > 0
          ? `Removed "${name}" (${data.dashboardsReclassified} dashboards → Other)`
          : `Removed "${name}"`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Department Management</CardTitle>
        <CardDescription>
          Add, rename, or remove dashboard categories. &quot;Other&quot; is protected and cannot be modified.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border rounded-lg divide-y">
          {departments.map((dept) => {
            const isProtected = dept === "Other";
            const isEditing = editingName === dept;
            const count = deptCounts[dept] || 0;

            return (
              <div
                key={dept}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/50"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename(dept);
                          if (e.key === "Escape") setEditingName(null);
                        }}
                        className="h-8 max-w-[200px]"
                        autoFocus
                        disabled={saving}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleRename(dept)}
                        disabled={saving}
                      >
                        <Check className="size-4 text-green-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setEditingName(null)}
                        disabled={saving}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium">{dept}</span>
                      {isProtected && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                          <Shield className="size-3" />
                          protected
                        </span>
                      )}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {count} dashboard{count !== 1 ? "s" : ""}
                  </span>
                  {!isProtected && !isEditing && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditingName(dept);
                          setEditValue(dept);
                        }}
                        disabled={saving}
                        title="Rename"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleRemove(dept)}
                        disabled={saving}
                        title="Remove"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add new department */}
        <div className="flex items-center gap-2">
          <Input
            placeholder="New department name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            className="max-w-[250px]"
            disabled={saving}
          />
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={saving || !newName.trim()}
          >
            <Plus className="size-4 mr-1" />
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
