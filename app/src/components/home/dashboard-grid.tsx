"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Timestamp } from "firebase/firestore";

import { Button } from "@/components/ui/button";
import type { Dashboard } from "@/lib/types";
import type { Folder } from "@/lib/firestore/folders";
import type { SharedFolder } from "@/lib/firestore/shared-folders";

import { DashboardCard } from "./dashboard-card";

const PAGE_SIZE = 12;

export function DashboardGrid({
  dashboards,
  uid,
  isArchived,
  favoriteIds,
  viewedTimestamps,
  onToggleFavorite,
  emptyMessage,
  emptyAction,
  isAdmin,
  folders,
  sharedFolders,
}: {
  dashboards: Dashboard[];
  uid: string | undefined;
  isArchived?: boolean;
  favoriteIds: Set<string>;
  viewedTimestamps: Map<string, Timestamp>;
  onToggleFavorite: (id: string) => void;
  emptyMessage: string;
  emptyAction?: ReactNode;
  isAdmin?: boolean;
  folders?: Folder[];
  sharedFolders?: SharedFolder[];
}) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [dashboards.length]);

  if (dashboards.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center text-muted-foreground">
        <p className="text-sm">{emptyMessage}</p>
        {emptyAction}
      </div>
    );
  }

  const visibleDashboards = dashboards.slice(0, visibleCount);
  const hasMore = dashboards.length > visibleCount;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleDashboards.map((d) => {
          const viewedAt = viewedTimestamps.get(d.id);
          const isUpdated =
            d.createdBy !== uid &&
            Boolean(viewedAt) &&
            d.updatedAt &&
            d.updatedAt.toMillis() > viewedAt!.toMillis();

          return (
            <DashboardCard
              key={d.id}
              dashboard={d}
              isOwner={d.createdBy === uid}
              isArchived={isArchived}
              isFavorited={favoriteIds.has(d.id)}
              isUpdated={isUpdated}
              isAdmin={isAdmin}
              onToggleFavorite={() => onToggleFavorite(d.id)}
              folders={folders}
              sharedFolders={sharedFolders}
            />
          );
        })}
      </div>
      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
          >
            Load more ({dashboards.length - visibleCount} remaining)
          </Button>
        </div>
      )}
    </div>
  );
}
