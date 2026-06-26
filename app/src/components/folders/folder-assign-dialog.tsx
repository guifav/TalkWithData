"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { setDashboardFolders, type Folder } from "@/lib/firestore/folders";
import { FolderOpen, Check } from "lucide-react";
import { toast } from "sonner";

export function FolderAssignDialog({
  open,
  onOpenChange,
  dashboardId,
  dashboardTitle,
  folders,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboardId: string;
  dashboardTitle: string;
  folders: Folder[];
}) {
  const { firebaseUser } = useAuth();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Initialize selection based on current folder memberships
  useEffect(() => {
    const initial = new Set<string>();
    for (const folder of folders) {
      if (folder.dashboardIds.includes(dashboardId)) {
        initial.add(folder.id);
      }
    }
    setSelectedIds(initial);
  }, [folders, dashboardId]);

  const handleToggle = (folderId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const handleSave = async () => {
    if (!firebaseUser) return;
    setSaving(true);
    try {
      await setDashboardFolders(
        firebaseUser.uid,
        dashboardId,
        Array.from(selectedIds),
        folders
      );
      toast.success("Folders updated");
      onOpenChange(false);
    } catch {
      toast.error("Failed to update folders");
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">
            Add to folders
          </DialogTitle>
          <p className="text-xs text-muted-foreground truncate">{dashboardTitle}</p>
        </DialogHeader>

        {folders.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No folders yet. Create folders first via the filter bar.
          </p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => handleToggle(folder.id)}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-md hover:bg-accent text-left text-sm"
              >
                <div
                  className={`size-4 rounded border flex items-center justify-center shrink-0 ${
                    selectedIds.has(folder.id)
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-input"
                  }`}
                >
                  {selectedIds.has(folder.id) && <Check className="size-3" />}
                </div>
                <FolderOpen className="size-4 text-muted-foreground shrink-0" />
                <span className="truncate">{folder.name}</span>
              </button>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || folders.length === 0}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
