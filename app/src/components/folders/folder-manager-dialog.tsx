"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { createFolder, renameFolder, deleteFolder, type Folder } from "@/lib/firestore/folders";
import { Pencil, Trash2, Plus, FolderOpen } from "lucide-react";
import { toast } from "sonner";

export function FolderManagerDialog({
  open,
  onOpenChange,
  folders,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: Folder[];
}) {
  const { firebaseUser } = useAuth();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const uid = firebaseUser?.uid;

  const handleCreate = async () => {
    if (!uid || !newName.trim()) return;
    try {
      await createFolder(uid, newName.trim());
      setNewName("");
      toast.success("Folder created");
    } catch {
      toast.error("Failed to create folder");
    }
  };

  const handleRename = async (folderId: string) => {
    if (!uid || !editingName.trim()) return;
    try {
      await renameFolder(uid, folderId, editingName.trim());
      setEditingId(null);
      toast.success("Folder renamed");
    } catch {
      toast.error("Failed to rename folder");
    }
  };

  const handleDelete = async (folderId: string, name: string) => {
    if (!uid) return;
    if (!confirm(`Delete folder "${name}"? Dashboards won't be removed.`)) return;
    try {
      await deleteFolder(uid, folderId);
      toast.success("Folder deleted");
    } catch {
      toast.error("Failed to delete folder");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="size-5" />
            Manage Folders
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Create new folder */}
          <div className="flex gap-2">
            <Input
              placeholder="New folder name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="flex-1"
            />
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim()}>
              <Plus className="size-4" />
            </Button>
          </div>

          {/* Existing folders */}
          {folders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No folders yet. Create one above.
            </p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent group"
                >
                  {editingId === folder.id ? (
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(folder.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onBlur={() => handleRename(folder.id)}
                      className="h-7 text-sm flex-1"
                      autoFocus
                    />
                  ) : (
                    <>
                      <FolderOpen className="size-4 text-muted-foreground shrink-0" />
                      <span className="text-sm flex-1 truncate">{folder.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {folder.dashboardIds.length}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 opacity-0 group-hover:opacity-100"
                        onClick={() => {
                          setEditingId(folder.id);
                          setEditingName(folder.name);
                        }}
                      >
                        <Pencil className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 opacity-0 group-hover:opacity-100 text-destructive"
                        onClick={() => handleDelete(folder.id, folder.name)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
