"use client";

import { useState } from "react";
import { authFetch } from "@/lib/firebase/auth";
import type { Department } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  X,
  Search,
  Building2,
} from "lucide-react";
import { toast } from "sonner";

interface UserInfo {
  uid: string;
  email: string;
  displayName: string;
}

interface DepartmentsTabProps {
  departments: Department[];
  allUsers: UserInfo[];
  isSuperAdmin: boolean;
  onRefresh: () => void;
}

export function DepartmentsTab({
  departments,
  allUsers,
  isSuperAdmin,
  onRefresh,
}: DepartmentsTabProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [deleteDept, setDeleteDept] = useState<Department | null>(null);
  const [manageMembersDept, setManageMembersDept] = useState<Department | null>(
    null
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Departments</h2>
          <p className="text-sm text-muted-foreground">
            Organize users into departments for team management
          </p>
        </div>
        {isSuperAdmin && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4 mr-1" />
            New Department
          </Button>
        )}
      </div>

      {departments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Building2 className="size-12 mb-3 opacity-50" />
            <p className="text-sm">No departments created yet</p>
            {isSuperAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="size-4 mr-1" />
                Create First Department
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {departments.map((dept) => (
            <DepartmentCard
              key={dept.id}
              department={dept}
              allUsers={allUsers}
              isSuperAdmin={isSuperAdmin}
              onEdit={() => setEditDept(dept)}
              onDelete={() => setDeleteDept(dept)}
              onManageMembers={() => setManageMembersDept(dept)}
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <CreateDepartmentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={onRefresh}
      />

      {/* Edit Dialog */}
      {editDept && (
        <EditDepartmentDialog
          department={departments.find((d) => d.id === editDept.id) ?? editDept}
          open={!!editDept}
          onOpenChange={(open) => !open && setEditDept(null)}
          onUpdated={onRefresh}
        />
      )}

      {/* Delete Dialog */}
      {deleteDept && (
        <DeleteDepartmentDialog
          department={deleteDept}
          open={!!deleteDept}
          onOpenChange={(open) => !open && setDeleteDept(null)}
          onDeleted={onRefresh}
        />
      )}

      {/* Manage Members Dialog */}
      {manageMembersDept && (
        <ManageMembersDialog
          department={departments.find((d) => d.id === manageMembersDept.id) ?? manageMembersDept}
          allUsers={allUsers}
          open={!!manageMembersDept}
          onOpenChange={(open) => !open && setManageMembersDept(null)}
          onUpdated={onRefresh}
        />
      )}
    </div>
  );
}

// ---- Department Card ----

function DepartmentCard({
  department,
  allUsers,
  isSuperAdmin,
  onEdit,
  onDelete,
  onManageMembers,
}: {
  department: Department;
  allUsers: UserInfo[];
  isSuperAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onManageMembers: () => void;
}) {
  const memberCount = department.memberUids.length;
  const members = allUsers.filter((u) =>
    department.memberUids.includes(u.uid)
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{department.name}</CardTitle>
            {department.description && (
              <CardDescription className="mt-1">
                {department.description}
              </CardDescription>
            )}
          </div>
          {isSuperAdmin && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onEdit}
                title="Edit"
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={onDelete}
                title="Delete"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4" />
            <span>
              {memberCount} member{memberCount !== 1 ? "s" : ""}
            </span>
          </div>
          {isSuperAdmin && (
            <Button variant="outline" size="sm" onClick={onManageMembers}>
              Manage
            </Button>
          )}
        </div>
        {members.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {members.slice(0, 5).map((m) => (
              <Badge key={m.uid} variant="secondary" className="text-xs">
                {m.displayName || m.email.split("@")[0]}
              </Badge>
            ))}
            {members.length > 5 && (
              <Badge variant="secondary" className="text-xs">
                +{members.length - 5} more
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Create Department Dialog ----

function CreateDepartmentDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await authFetch("/api/admin/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create department");
      }
      toast.success(`Department "${name.trim()}" created`);
      setName("");
      setDescription("");
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Department</DialogTitle>
          <DialogDescription>
            Add a new department to organize users.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="dept-name">Name</Label>
            <Input
              id="dept-name"
              placeholder="e.g. Commercial, CS, Marketing"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dept-desc">Description (optional)</Label>
            <Input
              id="dept-desc"
              placeholder="Brief description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving || !name.trim()}>
            {saving ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Edit Department Dialog ----

function EditDepartmentDialog({
  department,
  open,
  onOpenChange,
  onUpdated,
}: {
  department: Department;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}) {
  const [name, setName] = useState(department.name);
  const [description, setDescription] = useState(department.description || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await authFetch("/api/admin/departments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: department.id,
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update department");
      }
      toast.success(`Department updated`);
      onOpenChange(false);
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Department</DialogTitle>
          <DialogDescription>
            Update department name and description.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-desc">Description (optional)</Label>
            <Input
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Delete Department Dialog ----

function DeleteDepartmentDialog({
  department,
  open,
  onOpenChange,
  onDeleted,
}: {
  department: Department;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await authFetch("/api/admin/departments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: department.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete department");
      }
      toast.success(`Department "${department.name}" deleted`);
      onOpenChange(false);
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Department</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &quot;{department.name}&quot;?
            {department.memberUids.length > 0 && (
              <>
                {" "}
                This will remove {department.memberUids.length} member
                {department.memberUids.length !== 1 ? "s" : ""} from the
                department.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Manage Members Dialog ----

function ManageMembersDialog({
  department,
  allUsers,
  open,
  onOpenChange,
  onUpdated,
}: {
  department: Department;
  allUsers: UserInfo[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}) {
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const currentMembers = allUsers.filter((u) =>
    department.memberUids.includes(u.uid)
  );
  const nonMembers = allUsers.filter(
    (u) => !department.memberUids.includes(u.uid)
  );
  const filteredNonMembers = search.trim()
    ? nonMembers.filter(
        (u) =>
          u.email.toLowerCase().includes(search.toLowerCase()) ||
          u.displayName.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  const handleAdd = async (uid: string) => {
    setSaving(true);
    try {
      const res = await authFetch("/api/admin/departments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: department.id, addUids: [uid] }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }
      const user = allUsers.find((u) => u.uid === uid);
      toast.success(`Added ${user?.displayName || "user"} to ${department.name}`);
      setSearch("");
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (uid: string) => {
    setSaving(true);
    try {
      const res = await authFetch("/api/admin/departments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: department.id, removeUids: [uid] }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }
      const user = allUsers.find((u) => u.uid === uid);
      toast.success(
        `Removed ${user?.displayName || "user"} from ${department.name}`
      );
      onUpdated();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove member"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Members — {department.name}</DialogTitle>
          <DialogDescription>
            Add or remove users from this department.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Current members */}
          <div>
            <Label className="text-sm font-medium">
              Current Members ({currentMembers.length})
            </Label>
            <div className="mt-2 space-y-1 max-h-[200px] overflow-y-auto">
              {currentMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No members yet
                </p>
              ) : (
                currentMembers.map((u) => (
                  <div
                    key={u.uid}
                    className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {u.displayName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {u.email}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => handleRemove(u.uid)}
                      disabled={saving}
                      title="Remove"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Search to add */}
          <div>
            <Label className="text-sm font-medium">Add Member</Label>
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                disabled={saving}
              />
            </div>
            {filteredNonMembers.length > 0 && (
              <div className="mt-2 border rounded-lg max-h-[200px] overflow-y-auto divide-y">
                {filteredNonMembers.slice(0, 10).map((u) => (
                  <div
                    key={u.uid}
                    className="flex items-center justify-between py-1.5 px-3 hover:bg-muted/50 cursor-pointer"
                    onClick={() => !saving && handleAdd(u.uid)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {u.displayName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {u.email}
                      </p>
                    </div>
                    <Plus className="size-4 text-muted-foreground shrink-0" />
                  </div>
                ))}
                {filteredNonMembers.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    +{filteredNonMembers.length - 10} more — refine your search
                  </p>
                )}
              </div>
            )}
            {search.trim() && filteredNonMembers.length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                No users found matching &quot;{search}&quot;
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
