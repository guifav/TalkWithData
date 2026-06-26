"use client";

import { useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Dashboard } from "@/lib/types";
import type { Folder } from "@/lib/firestore/folders";
import type { SharedFolder } from "@/lib/firestore/shared-folders";

import { DashboardCard } from "./dashboard-card";

export function DashboardStrip({
  title,
  icon,
  dashboards,
  uid,
  favoriteIds,
  isAdmin,
  folders,
  sharedFolders,
  onToggleFavorite,
}: {
  title: string;
  icon: ReactNode;
  dashboards: Dashboard[];
  uid: string | undefined;
  favoriteIds: Set<string>;
  isAdmin?: boolean;
  folders?: Folder[];
  sharedFolders?: SharedFolder[];
  onToggleFavorite: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  if (dashboards.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          {icon}
          {title}
        </h2>
        {dashboards.length > 3 && (
          <div className="hidden sm:flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => scroll("left")}
              aria-label="Rolar para a esquerda"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => scroll("right")}
              aria-label="Rolar para a direita"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </div>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 -mx-1 px-1 [scrollbar-width:thin]"
      >
        {dashboards.map((d) => (
          <div
            key={d.id}
            className="snap-start shrink-0 w-[min(85vw,320px)]"
          >
            <DashboardCard
              dashboard={d}
              isOwner={d.createdBy === uid}
              isFavorited={favoriteIds.has(d.id)}
              isAdmin={isAdmin}
              onToggleFavorite={() => onToggleFavorite(d.id)}
              folders={folders}
              sharedFolders={sharedFolders}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
