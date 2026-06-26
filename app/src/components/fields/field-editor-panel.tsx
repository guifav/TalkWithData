"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { FieldSchema, FieldValues } from "@/hooks/use-dashboard-fields";

interface FieldEditorPanelProps {
  fields: FieldSchema[];
  values: FieldValues;
  loading: boolean;
  onSave: (values: Record<string, string | null>) => Promise<{
    success: boolean;
    errors: Record<string, string>;
  }>;
}

export function FieldEditorPanel({
  fields,
  values,
  loading,
  onSave,
}: FieldEditorPanelProps) {
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Sync from server values
  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const field of fields) {
      initial[field.key] = values[field.key]?.value ?? "";
    }
    setLocalValues(initial);
    setDirty(false);
    setErrors({});
  }, [fields, values]);

  if (loading || fields.length === 0) return null;

  const handleChange = (key: string, value: string) => {
    setLocalValues((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setErrors({});

    const toSave: Record<string, string | null> = {};
    for (const field of fields) {
      const val = localValues[field.key]?.trim() || "";
      toSave[field.key] = val || null;
    }

    const result = await onSave(toSave);
    setSaving(false);

    if (result.success) {
      toast.success("Fields saved");
      setDirty(false);
    } else if (Object.keys(result.errors).length > 0) {
      setErrors(result.errors);
      toast.error("Some fields have validation errors");
    } else {
      toast.error("Failed to save fields");
    }
  };

  const renderInput = (field: FieldSchema) => {
    const value = localValues[field.key] ?? "";

    switch (field.type) {
      case "SELECT":
        return (
          <select
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">—</option>
            {field.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );

      case "MULTI_SELECT":
        return (
          <div className="flex flex-wrap gap-1">
            {field.options.map((opt) => {
              const selected = value.split(",").map((s) => s.trim()).includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    const current = value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    const next = selected
                      ? current.filter((v) => v !== opt)
                      : [...current, opt];
                    handleChange(field.key, next.join(","));
                  }}
                  className={`px-2 py-0.5 rounded text-xs border ${
                    selected
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-foreground border-input hover:bg-muted"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        );

      case "BOOLEAN":
        return (
          <select
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">—</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        );

      case "DATE":
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            className="h-8 text-sm"
          />
        );

      case "NUMBER":
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            className="h-8 text-sm"
          />
        );

      case "URL":
        return (
          <Input
            type="url"
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            placeholder="https://..."
            className="h-8 text-sm"
          />
        );

      default:
        return (
          <Input
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            className="h-8 text-sm"
          />
        );
    }
  };

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Fields</h3>
        {dirty && (
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="h-7 text-xs"
          >
            {saving ? (
              <Loader2 className="size-3 animate-spin mr-1" />
            ) : (
              <Save className="size-3 mr-1" />
            )}
            Save
          </Button>
        )}
      </div>

      <div className="grid gap-3">
        {fields.map((field) => (
          <div key={field.key}>
            <Label className="text-xs text-muted-foreground">
              {field.name}
              {field.required && <span className="text-destructive ml-0.5">*</span>}
            </Label>
            {renderInput(field)}
            {errors[field.key] && (
              <p className="text-xs text-destructive mt-0.5">
                {errors[field.key]}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
