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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useCategories } from "@/hooks/use-categories";

export interface SaveDashboardData {
  title: string;
  description: string;
  category: string;
  visibility: "team" | "specific";
  allowedEmails: string[];
}

interface SaveDashboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: SaveDashboardData) => void;
  saving: boolean;
  defaultTitle?: string;
  /** When true, hides title/description (edit mode uses existing values) */
  editMode?: boolean;
}

export function SaveDashboardDialog({
  open,
  onOpenChange,
  onSave,
  saving,
  defaultTitle = "",
  editMode = false,
}: SaveDashboardDialogProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Other");
  const [visibility, setVisibility] = useState<"team" | "specific">("team");
  const [allowedEmails, setAllowedEmails] = useState("");
  const { categories, loading: categoriesLoading } = useCategories();

  // Reset form when dialog opens or defaultTitle changes
  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setDescription("");
      setCategory("Other");
      setVisibility("team");
      setAllowedEmails("");
    }
  }, [open, defaultTitle]);

  const handleSave = () => {
    if (!editMode && !title.trim()) return;
    onSave({
      title: title.trim() || defaultTitle,
      description: description.trim(),
      category,
      visibility,
      allowedEmails:
        visibility === "specific"
          ? allowedEmails
              .split(/[\n,]+/)
              .map((e) => e.trim().toLowerCase())
              .filter((e) => e.endsWith("@example.com"))
          : [],
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {editMode ? "Update Dashboard" : "Save Dashboard"}
          </DialogTitle>
          <DialogDescription>
            {editMode
              ? "Your changes will be saved as a new version."
              : "Fill in the details for your new dashboard."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!editMode && (
            <>
              <div className="space-y-2">
                <Label htmlFor="save-title">Title</Label>
                <Input
                  id="save-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Dashboard title"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="save-description">Description (optional)</Label>
                <Textarea
                  id="save-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this dashboard"
                  rows={2}
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="save-category">Category</Label>
            <select
              id="save-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={categoriesLoading}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            >
              {categoriesLoading ? (
                <option>Loading...</option>
              ) : (
                categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="space-y-3">
            <Label>Visibility</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="save-visibility"
                  value="team"
                  checked={visibility === "team"}
                  onChange={() => setVisibility("team")}
                  className="accent-primary"
                />
                <span className="text-sm">All internal team</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="save-visibility"
                  value="specific"
                  checked={visibility === "specific"}
                  onChange={() => setVisibility("specific")}
                  className="accent-primary"
                />
                <span className="text-sm">Specific people</span>
              </label>
            </div>
            {visibility === "specific" && (
              <div className="space-y-2">
                <Label htmlFor="save-emails">Email addresses</Label>
                <Textarea
                  id="save-emails"
                  value={allowedEmails}
                  onChange={(e) => setAllowedEmails(e.target.value)}
                  placeholder="Enter email addresses, one per line"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  One @example.com email per line. Non-internal emails will be ignored.
                </p>
              </div>
            )}
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
          <Button
            onClick={handleSave}
            disabled={saving || (!editMode && !title.trim())}
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {editMode ? "Update" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
