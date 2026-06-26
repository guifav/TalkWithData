"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { updateDashboard } from "@/lib/firestore/dashboards";
import { authFetch } from "@/lib/firebase/auth";
import type { Dashboard } from "@/lib/types";
import type { SharedFolder } from "@/lib/firestore/shared-folders";
import { Badge } from "@/components/ui/badge";
import { FolderOpen } from "lucide-react";

interface DepartmentOption {
  id: string;
  name: string;
  description: string | null;
}

interface SharingDialogProps {
  dashboard: Dashboard;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sharedFolders?: SharedFolder[];
}

export function SharingDialog({ dashboard, open, onOpenChange, sharedFolders = [] }: SharingDialogProps) {
  const [visibility, setVisibility] = useState<"team" | "specific">(dashboard.visibility);
  const [emails, setEmails] = useState(dashboard.allowedEmails.join("\n"));
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(
    dashboard.allowedDepartments ?? []
  );
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [saving, setSaving] = useState(false);

  // Find shared folders that contain this dashboard
  const inheritedFolders = sharedFolders.filter((f) =>
    f.dashboardIds.includes(dashboard.id)
  );

  // Load departments when dialog opens and visibility is specific
  useEffect(() => {
    if (!open) return;

    setLoadingDepts(true);
    authFetch("/api/departments")
      .then((res) => res.json())
      .then((data) => {
        if (data.departments) {
          setDepartments(data.departments);
        }
      })
      .catch((err) => {
        console.warn("Failed to load departments:", err);
      })
      .finally(() => setLoadingDepts(false));
  }, [open]);

  // Reset state when dialog opens with new dashboard data
  useEffect(() => {
    if (open) {
      setVisibility(dashboard.visibility);
      setEmails(dashboard.allowedEmails.join("\n"));
      setSelectedDepartments(dashboard.allowedDepartments ?? []);
    }
  }, [open, dashboard]);

  const toggleDepartment = (deptId: string) => {
    setSelectedDepartments((prev) =>
      prev.includes(deptId)
        ? prev.filter((id) => id !== deptId)
        : [...prev, deptId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const allowedEmails =
        visibility === "specific"
          ? emails
              .split(/[\n,]/)
              .map((e) => e.trim().toLowerCase())
              .filter((e) => e.endsWith("@griinstitute.org"))
          : [];

      const allowedDepartments =
        visibility === "specific" ? selectedDepartments : [];

      await updateDashboard(dashboard.id, {
        visibility,
        allowedEmails,
        allowedDepartments,
      });
      toast.success("Sharing settings updated");
      onOpenChange(false);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to update";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Sharing</DialogTitle>
          <DialogDescription>
            Choose who can see this dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Shared folder inheritance info */}
          {inheritedFolders.length > 0 && (
            <div className="rounded-md border bg-muted/50 p-3 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Inherited access from shared folders:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {inheritedFolders.map((f) => (
                  <Badge
                    key={f.id}
                    variant="secondary"
                    className="gap-1 text-xs font-normal"
                  >
                    <FolderOpen className="size-3" />
                    {f.name}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Users with access to these folders can also view this dashboard.
                Manage folder sharing separately.
              </p>
            </div>
          )}

          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="sharing-visibility"
                value="team"
                checked={visibility === "team"}
                onChange={() => setVisibility("team")}
                className="accent-primary"
              />
              <span className="text-sm">All GRI team</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="sharing-visibility"
                value="specific"
                checked={visibility === "specific"}
                onChange={() => setVisibility("specific")}
                className="accent-primary"
              />
              <span className="text-sm">Specific people</span>
            </label>
          </div>
          {visibility === "specific" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="sharing-emails">Email addresses</Label>
                <Textarea
                  id="sharing-emails"
                  value={emails}
                  onChange={(e) => setEmails(e.target.value)}
                  placeholder="Enter email addresses, one per line"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  One email per line. Only @griinstitute.org addresses.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Departments</Label>
                {loadingDepts ? (
                  <p className="text-xs text-muted-foreground">Loading departments...</p>
                ) : departments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No departments available.</p>
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
                <p className="text-xs text-muted-foreground">
                  All members of selected departments will have access.
                </p>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
