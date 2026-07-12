"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Timestamp } from "firebase/firestore";
import {
  Clock,
  FolderOpen,
  Plus,
  Settings2,
  Share2,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { useCategories } from "@/hooks/use-categories";
import { useFolders } from "@/hooks/use-folders";
import { useSharedFolders } from "@/hooks/use-shared-folders";
import { useMcpAccess } from "@/hooks/mcp-access-context";
import {
  subscribeToDashboards,
  subscribeToArchivedDashboards,
  getDashboardsByIds,
} from "@/lib/firestore/dashboards";
import {
  getFavorites,
  addFavorite,
  removeFavorite,
  getRecent,
  getViewedTimestamps,
} from "@/lib/firestore/favorites";
import { authFetch } from "@/lib/firebase/auth";
import { getFavoriteDashboards } from "@/lib/home-dashboard-filters";
import type { Dashboard } from "@/lib/types";

import { AppShell } from "@/components/layout/app-shell";
import { HomeSkeleton } from "@/components/skeletons/home-skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FolderManagerDialog } from "@/components/folders/folder-manager-dialog";
import { SharedFolderManagerDialog } from "@/components/folders/shared-folder-manager";
import { HomeHeader } from "@/components/home/home-header";
import { DashboardGrid } from "@/components/home/dashboard-grid";
import { DashboardStrip } from "@/components/home/dashboard-strip";
import { HomeEmptyState } from "@/components/home/home-empty-state";

export default function HomePage() {
  const { firebaseUser, isAuthenticated, loading } = useAuth();
  const { isAdmin } = useRole();
  const { hasAccess: hasMcpAccess } = useMcpAccess();
  const { categories } = useCategories();
  const { folders } = useFolders();
  const { sharedFolders, refresh: refreshSharedFolders } = useSharedFolders();
  const router = useRouter();

  const [directDashboards, setDirectDashboards] = useState<Dashboard[]>([]);
  const [sharedFolderDashboards, setSharedFolderDashboards] = useState<Dashboard[]>([]);
  const [archivedDashboards, setArchivedDashboards] = useState<Dashboard[]>([]);
  const [dashboardsLoaded, setDashboardsLoaded] = useState(false);
  const [archivedLoaded, setArchivedLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [sharedFolderFilter, setSharedFolderFilter] = useState<string | null>(null);

  // Derive visible categories from ALL visible dashboards (direct + shared folder) (#150)
  // Intersect with configured categories to exclude legacy/invalid values and preserve order
  const visibleCategories = useMemo(() => {
    const allVisible = [...directDashboards, ...sharedFolderDashboards];
    if (!dashboardsLoaded || allVisible.length === 0) return [];
    const visibleSet = new Set(allVisible.map((d) => d.category || "Other"));
    return categories.filter((cat) => visibleSet.has(cat));
  }, [directDashboards, sharedFolderDashboards, dashboardsLoaded, categories]);

  // Reset category filter when selected category disappears (or list empties)
  useEffect(() => {
    if (
      categoryFilter !== "All" &&
      !visibleCategories.includes(categoryFilter)
    ) {
      setCategoryFilter("All");
    }
  }, [visibleCategories, categoryFilter]);
  const [showFolderManager, setShowFolderManager] = useState(false);
  const [showSharedFolderManager, setShowSharedFolderManager] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [viewedTimestamps, setViewedTimestamps] = useState<
    Map<string, Timestamp>
  >(new Map());
  const [serverSearchIds, setServerSearchIds] = useState<Set<string> | null>(
    null
  );
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (folderFilter && !folders.some((f) => f.id === folderFilter)) {
      setFolderFilter(null);
    }
  }, [folderFilter, folders]);

  useEffect(() => {
    if (sharedFolderFilter && !sharedFolders.some((f) => f.id === sharedFolderFilter)) {
      setSharedFolderFilter(null);
    }
  }, [sharedFolderFilter, sharedFolders]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (!firebaseUser) return;
    const unsub = subscribeToDashboards(
      firebaseUser.uid,
      (d: Dashboard[]) => { setDirectDashboards(d); setDashboardsLoaded(true); },
    );
    return unsub;
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) return;
    const unsub = subscribeToArchivedDashboards(
      firebaseUser.uid,
      (d: Dashboard[]) => { setArchivedDashboards(d); setArchivedLoaded(true); }
    );
    return unsub;
  }, [firebaseUser]);

  // Fetch dashboards from shared folders that aren't already in directDashboards
  useEffect(() => {
    if (!firebaseUser || sharedFolders.length === 0) {
      setSharedFolderDashboards([]);
      return;
    }
    const directIds = new Set(directDashboards.map((d) => d.id));
    const neededIds = new Set<string>();
    for (const sf of sharedFolders) {
      for (const id of sf.dashboardIds) {
        if (!directIds.has(id)) neededIds.add(id);
      }
    }
    if (neededIds.size === 0) {
      setSharedFolderDashboards([]);
      return;
    }
    getDashboardsByIds(Array.from(neededIds)).then(setSharedFolderDashboards).catch(() => {});
  }, [firebaseUser, sharedFolders, directDashboards]);

  // Merge direct + shared folder dashboards
  const dashboards = useMemo(() => {
    if (sharedFolderDashboards.length === 0) return directDashboards;
    const seen = new Set(directDashboards.map((d) => d.id));
    const merged = [...directDashboards];
    for (const d of sharedFolderDashboards) {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        merged.push(d);
      }
    }
    return merged;
  }, [directDashboards, sharedFolderDashboards]);

  useEffect(() => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;

    getFavorites(uid).then((favs) => {
      setFavoriteIds(new Set(favs.map((f) => f.dashboardId)));
    });
    getRecent(uid).then((recs) => {
      setRecentIds(recs.map((r) => r.dashboardId));
    });
    getViewedTimestamps(uid).then(setViewedTimestamps);
  }, [firebaseUser]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (!search || search.length < 3) {
      setServerSearchIds(null);
      return;
    }

    searchTimer.current = setTimeout(async () => {
      try {
        const res = await authFetch(
          `/api/search?q=${encodeURIComponent(search)}`
        );
        if (res.ok) {
          const data = await res.json();
          const ids = new Set<string>(
            (data.results || []).map((r: { id: string }) => r.id)
          );
          setServerSearchIds(ids);
        }
      } catch {
        // Silent — fall back to client-side search
      }
    }, 300);

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search]);

  const handleToggleFavorite = useCallback(
    async (dashboardId: string) => {
      if (!firebaseUser) return;
      const uid = firebaseUser.uid;
      const isFav = favoriteIds.has(dashboardId);

      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (isFav) next.delete(dashboardId);
        else next.add(dashboardId);
        return next;
      });

      try {
        if (isFav) {
          await removeFavorite(uid, dashboardId);
        } else {
          await addFavorite(uid, dashboardId);
        }
      } catch {
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (isFav) next.add(dashboardId);
          else next.delete(dashboardId);
          return next;
        });
        toast.error("Failed to update favorite");
      }
    },
    [firebaseUser, favoriteIds]
  );

  const filterDashboards = useCallback(
    (list: Dashboard[]) => {
      let result = list;
      if (search) {
        const q = search.toLowerCase();
        result = result.filter(
          (d) =>
            d.title.toLowerCase().includes(q) ||
            d.description?.toLowerCase().includes(q) ||
            d.createdByName.toLowerCase().includes(q) ||
            (serverSearchIds !== null && serverSearchIds.has(d.id))
        );
      }
      if (categoryFilter !== "All") {
        result = result.filter(
          (d) => (d.category || "Other") === categoryFilter
        );
      }
      if (folderFilter) {
        const folder = folders.find((f) => f.id === folderFilter);
        if (folder) {
          const ids = new Set(folder.dashboardIds);
          result = result.filter((d) => ids.has(d.id));
        }
      }
      if (sharedFolderFilter) {
        const sf = sharedFolders.find((f) => f.id === sharedFolderFilter);
        if (sf) {
          const ids = new Set(sf.dashboardIds);
          result = result.filter((d) => ids.has(d.id));
        }
      }
      return result;
    },
    [search, categoryFilter, serverSearchIds, folderFilter, folders, sharedFolderFilter, sharedFolders]
  );

  const filtered = useMemo(
    () => filterDashboards(dashboards),
    [dashboards, filterDashboards]
  );
  const filteredArchived = useMemo(
    () => filterDashboards(archivedDashboards),
    [archivedDashboards, filterDashboards]
  );

  const myDashboards = useMemo(
    () => filtered.filter((d) => d.createdBy === firebaseUser?.uid),
    [filtered, firebaseUser]
  );
  const sharedDashboards = useMemo(
    () => filtered.filter((d) => d.createdBy !== firebaseUser?.uid),
    [filtered, firebaseUser]
  );

  const favoriteDashboards = useMemo(() => {
    return getFavoriteDashboards(filtered, favoriteIds);
  }, [filtered, favoriteIds]);

  const recentDashboards = useMemo(() => {
    if (recentIds.length === 0) return [];
    const dashMap = new Map(dashboards.map((d) => [d.id, d]));
    return recentIds
      .map((id) => dashMap.get(id))
      .filter(Boolean) as Dashboard[];
  }, [dashboards, recentIds]);

  if (loading || !isAuthenticated || !dashboardsLoaded || !archivedLoaded) {
    return <HomeSkeleton />;
  }

  const uid = firebaseUser?.uid;
  const hasNoDashboards = dashboards.length === 0 && archivedDashboards.length === 0 && !loading;
  const isFiltering = Boolean(search) || categoryFilter !== "All" || Boolean(folderFilter) || Boolean(sharedFolderFilter);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl space-y-6">
        {hasNoDashboards ? (
          <HomeEmptyState
            userName={firebaseUser?.displayName}
            hasMcpAccess={hasMcpAccess}
          />
        ) : (
          <>
            <HomeHeader
              search={search}
              onSearchChange={setSearch}
              categories={visibleCategories}
              categoryFilter={categoryFilter}
              onCategoryChange={setCategoryFilter}
              hasMcpAccess={hasMcpAccess}
            />

            <div className="flex items-center gap-1.5 flex-wrap">
              <FolderOpen className="size-4 text-muted-foreground" />
              {folders.length > 0 && (
                <>
                  <Button
                    variant={folderFilter === null ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFolderFilter(null)}
                    className="text-xs h-7"
                  >
                    All
                  </Button>
                  {folders.map((f) => (
                    <Button
                      key={f.id}
                      variant={folderFilter === f.id ? "default" : "outline"}
                      size="sm"
                      onClick={() =>
                        setFolderFilter(folderFilter === f.id ? null : f.id)
                      }
                      className="text-xs h-7"
                    >
                      {f.name} ({f.dashboardIds.length})
                    </Button>
                  ))}
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 gap-1"
                onClick={() => setShowFolderManager(true)}
              >
                {folders.length === 0 ? (
                  <>
                    <Plus className="size-3" /> New folder
                  </>
                ) : (
                  <Settings2 className="size-3.5" />
                )}
              </Button>
            </div>

            {/* Shared Folders filter bar */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Share2 className="size-4 text-muted-foreground" />
              {sharedFolders.length > 0 && (
                <>
                  {sharedFolders.map((f) => (
                    <Button
                      key={f.id}
                      variant={sharedFolderFilter === f.id ? "default" : "outline"}
                      size="sm"
                      onClick={() =>
                        setSharedFolderFilter(sharedFolderFilter === f.id ? null : f.id)
                      }
                      className="text-xs h-7"
                    >
                      {f.name} ({f.dashboardIds.length})
                    </Button>
                  ))}
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 gap-1"
                onClick={() => setShowSharedFolderManager(true)}
              >
                {sharedFolders.length === 0 ? (
                  <>
                    <Plus className="size-3" /> Shared folder
                  </>
                ) : (
                  <Settings2 className="size-3.5" />
                )}
              </Button>
            </div>

            {!isFiltering && (
              <DashboardStrip
                title="Recently viewed"
                icon={<Clock className="size-4" />}
                dashboards={recentDashboards.slice(0, 10)}
                uid={uid}
                favoriteIds={favoriteIds}
                isAdmin={isAdmin}
                folders={folders}
                sharedFolders={sharedFolders}
                onToggleFavorite={handleToggleFavorite}
              />
            )}

            <Tabs defaultValue="mine">
              <TabsList className="group-data-[orientation=horizontal]/tabs:h-auto flex-wrap justify-start">
                <TabsTrigger value="mine">
                  My dashboards ({myDashboards.length})
                </TabsTrigger>
                <TabsTrigger value="shared">
                  Shared ({sharedDashboards.length})
                </TabsTrigger>
                <TabsTrigger value="favorites">
                  Favorites ({favoriteDashboards.length})
                </TabsTrigger>
                <TabsTrigger value="archived">
                  Archived ({filteredArchived.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="mine">
                <DashboardGrid
                  dashboards={myDashboards}
                  uid={uid}
                  favoriteIds={favoriteIds}
                  viewedTimestamps={viewedTimestamps}
                  onToggleFavorite={handleToggleFavorite}
                  isAdmin={isAdmin}
                  emptyMessage={
                    isFiltering
                      ? "None of your dashboards match the filters."
                      : "You have not created any dashboards yet."
                  }
                  emptyAction={
                    !isFiltering && (
                      <Button asChild size="sm" variant="outline">
                        <Link href="/upload">Upload your first dashboard</Link>
                      </Button>
                    )
                  }
                  folders={folders}
                  sharedFolders={sharedFolders}
                />
              </TabsContent>

              <TabsContent value="shared">
                <DashboardGrid
                  dashboards={sharedDashboards}
                  uid={uid}
                  favoriteIds={favoriteIds}
                  viewedTimestamps={viewedTimestamps}
                  onToggleFavorite={handleToggleFavorite}
                  isAdmin={isAdmin}
                  emptyMessage={
                    isFiltering
                      ? "No shared dashboards match the filters."
                      : "No dashboards have been shared with you yet."
                  }
                  folders={folders}
                  sharedFolders={sharedFolders}
                />
              </TabsContent>

              <TabsContent value="favorites">
                <DashboardGrid
                  dashboards={favoriteDashboards}
                  uid={uid}
                  favoriteIds={favoriteIds}
                  viewedTimestamps={viewedTimestamps}
                  onToggleFavorite={handleToggleFavorite}
                  isAdmin={isAdmin}
                  emptyMessage={
                    isFiltering
                      ? "No favorite dashboards match the filters."
                      : "You do not have any favorite dashboards yet."
                  }
                  folders={folders}
                  sharedFolders={sharedFolders}
                />
              </TabsContent>

              <TabsContent value="archived">
                <DashboardGrid
                  dashboards={filteredArchived}
                  uid={uid}
                  isArchived
                  favoriteIds={favoriteIds}
                  viewedTimestamps={viewedTimestamps}
                  onToggleFavorite={handleToggleFavorite}
                  isAdmin={isAdmin}
                  emptyMessage="No archived dashboards."
                  folders={folders}
                  sharedFolders={sharedFolders}
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      <FolderManagerDialog
        open={showFolderManager}
        onOpenChange={setShowFolderManager}
        folders={folders}
      />

      <SharedFolderManagerDialog
        open={showSharedFolderManager}
        onOpenChange={setShowSharedFolderManager}
        sharedFolders={sharedFolders}
        onRefresh={refreshSharedFolders}
        userDashboards={directDashboards}
      />
    </AppShell>
  );
}
