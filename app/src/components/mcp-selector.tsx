"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database, Check, ChevronDown } from "lucide-react";
import type { McpServer } from "@/lib/types";

interface McpSelectorProps {
  mcpServers: McpServer[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export function McpSelector({
  mcpServers,
  selectedIds,
  onSelectionChange,
}: McpSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const allSelected = selectedIds.length === mcpServers.length;

  const toggleAll = useCallback(() => {
    if (!allSelected) {
      onSelectionChange(mcpServers.map((s) => s.id));
    }
    // When all selected, do nothing — at least one must remain selected
  }, [allSelected, mcpServers, onSelectionChange]);

  const toggleOne = useCallback(
    (id: string) => {
      if (selectedIds.includes(id)) {
        // Prevent deselecting the last remaining source
        if (selectedIds.length <= 1) return;
        onSelectionChange(selectedIds.filter((sid) => sid !== id));
      } else {
        onSelectionChange([...selectedIds, id]);
      }
    },
    [selectedIds, onSelectionChange]
  );

  if (mcpServers.length <= 1) return null;

  return (
    <div ref={containerRef} className="relative inline-block">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={() => setOpen(!open)}
      >
        <Database className="size-3.5" />
        <span>
          Data Sources ({selectedIds.length}/{mcpServers.length})
        </span>
        <ChevronDown
          className={`size-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </Button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 z-50 w-72 rounded-lg border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95">
          {/* Select All toggle */}
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent text-muted-foreground"
            onClick={toggleAll}
          >
            <div
              className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                allSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground/30"
              }`}
            >
              {allSelected && <Check className="size-3" />}
            </div>
            <span>Select All</span>
          </button>

          <div className="my-1 h-px bg-border" />

          {/* Server list */}
          <div className="max-h-48 overflow-y-auto">
            {mcpServers.map((server) => {
              const checked = selectedIds.includes(server.id);
              return (
                <button
                  key={server.id}
                  type="button"
                  className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent"
                  onClick={() => toggleOne(server.id)}
                >
                  <div
                    className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border ${
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30"
                    }`}
                  >
                    {checked && <Check className="size-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium truncate">
                        {server.name}
                      </span>
                      <Badge variant="secondary" className="text-[10px] px-1 py-0 shrink-0">
                        {server.toolCount} tools
                      </Badge>
                    </div>
                    {server.description && (
                      <p className="text-muted-foreground truncate mt-0.5">
                        {server.description}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
