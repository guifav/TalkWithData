"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { updateDashboard } from "@/lib/firestore/dashboards";
import type { Dashboard } from "@/lib/types";

interface RenameDialogProps {
  dashboard: Dashboard;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RenameDialog({ dashboard, open, onOpenChange }: RenameDialogProps) {
  const [title, setTitle] = useState(dashboard.title);
  const [description, setDescription] = useState(dashboard.description || "");
  const [slug, setSlug] = useState(dashboard.slug || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const slugChanged = slug.trim() !== (dashboard.slug || "");
      const updates: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || null,
      };
      if (slugChanged) {
        // User explicitly changed the slug — send it
        updates.slug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "");
      } else {
        // Title may have changed but slug was NOT edited — keep current slug
        updates.keepSlug = true;
      }
      await updateDashboard(dashboard.id, updates as Partial<Pick<Dashboard, "title" | "description" | "slug">>);
      toast.success("Dashboard updated");
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
          <DialogTitle>Rename Dashboard</DialogTitle>
          <DialogDescription>
            Update the title and description.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rename-title">Title</Label>
            <Input
              id="rename-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Dashboard title"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rename-slug">URL slug</Label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground shrink-0">dashs.mygri.com/view/</span>
              <Input
                id="rename-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="my-dashboard"
                className="text-sm"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rename-desc">Description</Label>
            <Textarea
              id="rename-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!title.trim() || saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
