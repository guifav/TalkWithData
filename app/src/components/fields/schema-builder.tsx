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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, GripVertical } from "lucide-react";
import type { FieldSchema } from "@/hooks/use-dashboard-fields";

const FIELD_TYPES = [
  { value: "TEXT", label: "Text" },
  { value: "NUMBER", label: "Number" },
  { value: "DATE", label: "Date" },
  { value: "SELECT", label: "Select" },
  { value: "MULTI_SELECT", label: "Multi Select" },
  { value: "URL", label: "URL" },
  { value: "BOOLEAN", label: "Boolean" },
] as const;

interface LocalField {
  key: string;
  name: string;
  type: string;
  required: boolean;
  options: string[];
  isNew?: boolean;
  /** Stable identifier for React list key (separate from persisted field.key) */
  uiId?: string;
}

function generateKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 50) || `field_${Date.now()}`;
}

interface SchemaBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialFields: FieldSchema[];
  loading: boolean;
  onSave: (
    fields: Array<{
      key: string;
      name: string;
      type: string;
      required: boolean;
      options: string[];
      order: number;
    }>
  ) => Promise<boolean>;
}

export function SchemaBuilder({
  open,
  onOpenChange,
  initialFields,
  loading,
  onSave,
}: SchemaBuilderProps) {
  const [fields, setFields] = useState<LocalField[]>([]);
  const [saving, setSaving] = useState(false);

  // Sync from initialFields when data loads (or dialog opens)
  useEffect(() => {
    if (initialFields.length > 0 || !loading) {
      setFields(
        initialFields.map((f) => ({
          key: f.key,
          name: f.name,
          type: f.type,
          required: f.required,
          options: f.options || [],
        }))
      );
    }
  }, [initialFields, loading]);

  const addField = () => {
    setFields((prev) => [
      ...prev,
      {
        key: "",
        name: "",
        type: "TEXT",
        required: false,
        options: [],
        isNew: true,
        uiId: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      },
    ]);
  };

  const updateField = (index: number, updates: Partial<LocalField>) => {
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== index) return f;
        const updated = { ...f, ...updates };
        // Derive key from name for unsaved fields (regenerate on every name change)
        if (updates.name !== undefined && f.isNew) {
          updated.key = generateKey(updates.name);
        }
        return updated;
      })
    );
  };

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const moveField = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= fields.length) return;
    setFields((prev) => {
      const next = [...prev];
      [next[index], next[newIndex]] = [next[newIndex], next[index]];
      return next;
    });
  };

  const handleSave = async () => {
    // Finalize keys for new fields that have a name but no key yet
    const finalFields = fields.map((f, i) => ({
      key: f.key || generateKey(f.name || `field_${i}`),
      name: f.name,
      type: f.type,
      required: f.required,
      options: f.options,
      order: i,
    }));

    // Filter out fields without a name
    const validFields = finalFields.filter((f) => f.name.trim());

    setSaving(true);
    const success = await onSave(validFields);
    setSaving(false);

    if (success) {
      onOpenChange(false);
    }
  };

  const needsOptions = (type: string) =>
    type === "SELECT" || type === "MULTI_SELECT";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Fields</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {fields.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No fields configured. Add your first field below.
            </p>
          )}

          {fields.map((field, index) => (
            <div
              key={field.uiId || field.key || `new-${index}`}
              className="flex gap-2 items-start p-3 border rounded-lg"
            >
              <div className="flex flex-col gap-1 pt-2">
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  onClick={() => moveField(index, -1)}
                  disabled={index === 0}
                >
                  <GripVertical className="size-4 rotate-180" />
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  onClick={() => moveField(index, 1)}
                  disabled={index === fields.length - 1}
                >
                  <GripVertical className="size-4" />
                </button>
              </div>

              <div className="flex-1 grid gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={field.name}
                      onChange={(e) =>
                        updateField(index, { name: e.target.value })
                      }
                      placeholder="Field name"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Type</Label>
                    <select
                      value={field.type}
                      onChange={(e) =>
                        updateField(index, { type: e.target.value })
                      }
                      className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {needsOptions(field.type) && (
                  <div>
                    <Label className="text-xs">
                      Options (comma-separated)
                    </Label>
                    <Input
                      value={field.options.join(", ")}
                      onChange={(e) =>
                        updateField(index, {
                          options: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="Option 1, Option 2, Option 3"
                      className="h-8 text-sm"
                    />
                  </div>
                )}

                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) =>
                      updateField(index, { required: e.target.checked })
                    }
                  />
                  Required
                </label>
              </div>

              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => removeField(index)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addField} className="w-full">
            <Plus className="size-4 mr-1" />
            Add Field
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "Saving..." : "Save Fields"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
