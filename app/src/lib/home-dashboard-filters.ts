import type { Dashboard } from "@/lib/types";

export function getFavoriteDashboards(
  dashboards: Dashboard[],
  favoriteIds: Set<string>
): Dashboard[] {
  if (favoriteIds.size === 0) return [];
  return dashboards.filter((dashboard) => favoriteIds.has(dashboard.id));
}
