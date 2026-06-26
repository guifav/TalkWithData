"use client";

import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { CreateMenu } from "./create-menu";

export function HomeHeader({
  search,
  onSearchChange,
  categories,
  categoryFilter,
  onCategoryChange,
  hasMcpAccess,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  categories: string[];
  categoryFilter: string;
  onCategoryChange: (value: string) => void;
  hasMcpAccess: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar dashboards..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <CreateMenu hasMcpAccess={hasMcpAccess} />
        </div>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {(categories.length > 0 ? ["Todas", ...categories] : []).map((cat) => {
          const value = cat === "Todas" ? "All" : cat;
          return (
            <Button
              key={cat}
              variant={categoryFilter === value ? "default" : "outline"}
              size="sm"
              onClick={() => onCategoryChange(value)}
              className="text-xs shrink-0"
            >
              {cat}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
