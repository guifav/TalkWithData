"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/use-auth";
import { authFetch } from "@/lib/firebase/auth";
import {
  createSharedFolder,
  updateSharedFolder,
  deleteSharedFolder,
  type SharedFolder,
} from "@/lib/firestore/shared-folders";
import {
  FolderOpen,
  LayoutDashboard,
  Pencil,
  Plus,
  Search,
  Share2,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { Dashboard } from "@/lib/types";
import {
import { getAllowedAuthDomain, isAllowedEmailDomain } from "@/lib/auth-domain";
  addDashboardToSharedFolder,
  removeDashboardFromSharedFolder,
} from "@/lib/firestore/shared-folders";

interface DepartmentOption {
  id: string;
  name: string;
  description: string | null;
}

// ---- Create / Edit Dialog ----
function SharedFolderEditDialog({
  open,
  onOpenChange,
  folder,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder?: SharedFolder | null;
  onSaved: () => void;
}) {
  const allowedAuthDomain = getAllowedAuthDomain();
  const [name, setName] = useState("");
  const [emails, setEmails] = useState("");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(folder?.name ?? "");
      setEmails(folder?.sharedWithEmails?.join("\n") ?? "");
      setSelectedDepartments(folder?.sharedWithDepartments ?? []);

      setLoadingDepts(true);
      authFetch("/api/departments")
        .then((res) => res.json())
        .then((data) => {
          if (data.departments) setDepartments(data.departments);
        })
        .catch(() => {})
        .finally(() => setLoadingDepts(false));
    }
  }, [open, folder]);

  const toggleDepartment = (deptId: string) => {
    setSelectedDepartments((prev) =>
      prev.includes(deptId)
        ? prev.filter((id) => id !== deptId)
        : [...prev, deptId]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const parsedEmails = emails
        .split(/[\n,]/)
        .map((e) => e.trim().toLowerCase())
        .filter(isAllowedEmailDomain);

      if (folder) {
        await updateSharedFolder(folder.id, {
          name: name.trim(),
          sharedWithEmails: parsedEmails,
          sharedWithDepartments: selectedDepartments,
        });
        toast.success("Shared folder updated");
      } else {
        await createSharedFolder({
          name: name.trim(),
          sharedWithEmails: parsedEmails,
          sharedWithDepartments: selectedDepartments,
        });
        toast.success("Shared folder created");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save shared folder"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {folder ? "Edit Shared Folder" : "Create Shared Folder"}
          </DialogTitle>
          <DialogDescription>
            {folder
              ? "Update sharing settings for this folder."
              : "Create a folder and share it with people or departments."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sf-name">Folder name</Label>
            <Input
              id="sf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Finance Reports"
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>

          <div className="border-t" />

          <div className="space-y-2">
            <Label htmlFor="sf-emails">Share with (emails)</Label>
            <Textarea
              id="sf-emails"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="Enter email addresses, one per line"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              One email per line. {`Only @${allowedAuthDomain} addresses.`}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Share with departments</Label>
            {loadingDepts ? (
              <p className="text-xs text-muted-foreground">
                Loading departments...
              </p>
            ) : departments.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No departments available.
              </p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto rounded border p-2">
                {departments.map((dept) => (
                  <label
                    key={dept.id}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedDepartments.includes(dept.id)}
                      onCheckedChange={() => toggleDepartment(dept.id)}
                    />
                    <span className="text-sm">{dept.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? "Saving..." : folder ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Manage Dashboards Dialog ----
function ManageDashboardsDialog({
  open,
  onOpenChange,
  folder,
  userDashboards,
  onRefresh,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: SharedFolder;
  userDashboards: Dashboard[];
  onRefresh: () => void;
}) {
  const { firebaseUser } = useAuth();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [localIds, setLocalIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setLocalIds(folder.dashboardIds);
      setSearch("");
    }
  }, [open, folder.dashboardIds]);

  const ownedDashboards = userDashboards.filter(
    (d) => d.createdBy === firebaseUser?.uid
  );

  const currentDashboards = ownedDashboards.filter((d) =>
    localIds.includes(d.id)
  );
  // Also show IDs in the folder that aren't in the user's list (owned by others / no access)
  const unknownIds = localIds.filter(
    (id) => !ownedDashboards.some((d) => d.id === id)
  );

  const availableDashboards = ownedDashboards.filter(
    (d) =>
      !localIds.includes(d.id) &&
      d.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async (dashId: string) => {
    setBusy(dashId);
    try {
      await addDashboardToSharedFolder(folder.id, dashId);
      setLocalIds((prev) => [...prev, dashId]);
      onRefresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to add dashboard"
      );
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async (dashId: string) => {
    setBusy(dashId);
    try {
      await removeDashboardFromSharedFolder(folder.id, dashId);
      setLocalIds((prev) => prev.filter((id) => id !== dashId));
      onRefresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove dashboard"
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutDashboard className="size-5" />
            Manage Dashboards
          </DialogTitle>
          <DialogDescription>
            Add or remove dashboards in &ldquo;{folder.name}&rdquo;. You can
            only add dashboards you own.
          </DialogDescription>
        </DialogHeader>

        {/* Current dashboards in folder */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            In this folder ({localIds.length})
          </Label>
          {currentDashboards.length === 0 && unknownIds.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No dashboards in this folder yet.
            </p>
          ) : (
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {currentDashboards.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent group"
                >
                  <LayoutDashboard className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm flex-1 truncate">{d.title}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 opacity-0 group-hover:opacity-100 text-destructive"
                    disabled={busy === d.id}
                    onClick={() => handleRemove(d.id)}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              ))}
              {unknownIds.map((id) => (
                <div
                  key={id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-muted-foreground"
                >
                  <LayoutDashboard className="size-3.5 shrink-0" />
                  <span className="text-sm flex-1 truncate italic">
                    {id} (not yours)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add dashboards */}
        <div className="space-y-2 border-t pt-3">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Add dashboards
          </Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search your dashboards..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          {availableDashboards.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              {search
                ? "No matching dashboards found."
                : ownedDashboards.length === localIds.length
                  ? "All your dashboards are already in this folder."
                  : "No dashboards available to add."}
            </p>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {availableDashboards.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent group"
                >
                  <LayoutDashboard className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm flex-1 truncate">{d.title}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100"
                    disabled={busy === d.id}
                    onClick={() => handleAdd(d.id)}
                  >
                    <Plus className="size-3 mr-1" />
                    Add
                  </Button>
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

// ---- Main Manager Dialog ----
export function SharedFolderManagerDialog({
  open,
  onOpenChange,
  sharedFolders,
  onRefresh,
  userDashboards = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sharedFolders: SharedFolder[];
  onRefresh: () => void;
  userDashboards?: Dashboard[];
}) {
  const { firebaseUser } = useAuth();
  const [editingFolder, setEditingFolder] = useState<SharedFolder | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [managingFolder, setManagingFolder] = useState<SharedFolder | null>(null);
  const [showManageDialog, setShowManageDialog] = useState(false);
  const uid = firebaseUser?.uid;

  const handleDelete = async (folder: SharedFolder) => {
    if (!confirm(`Delete shared folder "${folder.name}"? Dashboards won't be removed.`))
      return;
    try {
      await deleteSharedFolder(folder.id);
      toast.success("Shared folder deleted");
      onRefresh();
    } catch {
      toast.error("Failed to delete shared folder");
    }
  };

  const handleEdit = (folder: SharedFolder) => {
    setEditingFolder(folder);
    setShowEditDialog(true);
  };

  const handleCreate = () => {
    setEditingFolder(null);
    setShowEditDialog(true);
  };

  const sharingLabel = (folder: SharedFolder) => {
    const parts: string[] = [];
    if (folder.sharedWithEmails.length > 0) {
      parts.push(
        `${folder.sharedWithEmails.length} email${folder.sharedWithEmails.length > 1 ? "s" : ""}`
      );
    }
    if (folder.sharedWithDepartments.length > 0) {
      parts.push(
        `${folder.sharedWithDepartments.length} dept${folder.sharedWithDepartments.length > 1 ? "s" : ""}`
      );
    }
    return parts.length > 0 ? parts.join(", ") : "Not shared yet";
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="size-5" />
              Shared Folders
            </DialogTitle>
            <DialogDescription>
              Folders shared across the team. Dashboards inside inherit the
              folder's sharing permissions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Button
              size="sm"
              className="w-full gap-1"
              onClick={handleCreate}
            >
              <Plus className="size-4" />
              New Shared Folder
            </Button>

            {sharedFolders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No shared folders yet.
              </p>
            ) : (
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {sharedFolders.map((folder) => {
                  const isOwner = folder.createdBy === uid;
                  return (
                    <div
                      key={folder.id}
                      className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-accent group"
                    >
                      <FolderOpen className="size-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{folder.name}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="size-3" />
                          {sharingLabel(folder)}
                          <span className="mx-1">-</span>
                          {folder.dashboardIds.length} dashboard
                          {folder.dashboardIds.length !== 1 ? "s" : ""}
                        </div>
                      </div>
                      {isOwner && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 opacity-0 group-hover:opacity-100"
                            title="Manage dashboards"
                            onClick={() => {
                              setManagingFolder(folder);
                              setShowManageDialog(true);
                            }}
                          >
                            <LayoutDashboard className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 opacity-0 group-hover:opacity-100"
                            onClick={() => handleEdit(folder)}
                          >
                            <Pencil className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 opacity-0 group-hover:opacity-100 text-destructive"
                            onClick={() => handleDelete(folder)}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  );
                })}
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

      <SharedFolderEditDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        folder={editingFolder}
        onSaved={onRefresh}
      />

      {managingFolder && (
        <ManageDashboardsDialog
          open={showManageDialog}
          onOpenChange={setShowManageDialog}
          folder={managingFolder}
          userDashboards={userDashboards}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
}
