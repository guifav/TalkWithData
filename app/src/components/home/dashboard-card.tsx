"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Archive,
  BarChart3,
  Calendar,
  Code,
  Eye,
  FolderOpen,
  History,
  MoreVertical,
  Pencil,
  Sparkles,
  Star,
  Trash2,
  Upload,
  Users,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RenameDialog } from "@/components/dashboards/rename-dialog";
import { SharingDialog } from "@/components/dashboards/sharing-dialog";
import { ReplaceDialog } from "@/components/dashboards/replace-dialog";
import { DeleteDialog } from "@/components/dashboards/delete-dialog";
import { VersionsDialog } from "@/components/dashboards/versions-dialog";
import { AnalyticsDialog } from "@/components/dashboards/analytics-dialog";
import { FolderAssignDialog } from "@/components/folders/folder-assign-dialog";
import {
  archiveDashboard,
  unarchiveDashboard,
} from "@/lib/firestore/dashboards";
import { authFetch } from "@/lib/firebase/auth";
import type { Dashboard } from "@/lib/types";
import type { Folder } from "@/lib/firestore/folders";
import type { SharedFolder } from "@/lib/firestore/shared-folders";

import { getCategoryColor } from "./category-color";

function formatDate(ts: { toDate: () => Date } | null): string {
  if (!ts) return "";
  const d = ts.toDate();
  return d.toLocaleDateString("pt-BR", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type DialogType =
  | "rename"
  | "sharing"
  | "replace"
  | "delete"
  | "versions"
  | "analytics"
  | "folders"
  | null;

export function DashboardCard({
  dashboard,
  isOwner,
  isArchived,
  isFavorited,
  isUpdated,
  isAdmin,
  onToggleFavorite,
  folders,
  sharedFolders,
  className,
}: {
  dashboard: Dashboard;
  isOwner: boolean;
  isArchived?: boolean;
  isFavorited?: boolean;
  isUpdated?: boolean;
  isAdmin?: boolean;
  onToggleFavorite?: () => void;
  folders?: Folder[];
  sharedFolders?: SharedFolder[];
  className?: string;
}) {
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);
  const canCreateEmbed = true;
  const canManageSharing = isOwner || Boolean(isAdmin);

  const handleCopyEmbedLink = async () => {
    try {
      const res = await authFetch(
        `/api/dashboards/${dashboard.id}/embed-token`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Failed to generate embed token");
      const data = await res.json();
      await navigator.clipboard.writeText(data.embedUrl);
      toast.success("Link de embed copiado! Válido por 7 dias.");
    } catch {
      toast.error("Falha ao gerar link de embed");
    }
  };

  const handleArchiveToggle = async () => {
    try {
      if (isArchived) {
        await unarchiveDashboard(dashboard.id);
        toast.success("Dashboard desarquivado");
      } else {
        await archiveDashboard(dashboard.id);
        toast.success("Dashboard arquivado");
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Falha na ação";
      toast.error(msg);
    }
  };

  const category = dashboard.category || "Other";
  const isAi = dashboard.source === "ai";

  return (
    <>
      <div className={`relative group ${className ?? ""}`}>
        <Link href={`/view/${dashboard.slug || dashboard.id}`}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader>
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  {isAi && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 shrink-0"
                      title="Gerado com IA"
                    >
                      <Sparkles className="size-3" />
                      IA
                    </span>
                  )}
                  <CardTitle className="text-base line-clamp-1 min-w-0">
                    {dashboard.title}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getCategoryColor(category)}`}
                  >
                    {category}
                  </span>
                  <Badge variant="outline">
                    {dashboard.visibility === "team" ? "Time" : "Específico"}
                  </Badge>
                  {Boolean(isUpdated) && (
                    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                      Atualizado
                    </span>
                  )}
                  {canManageSharing && <div className="w-8" />}
                </div>
              </div>
              {dashboard.description && (
                <CardDescription className="line-clamp-2">
                  {dashboard.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="truncate">{dashboard.createdByName}</span>
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" />
                  {formatDate(dashboard.createdAt)}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="size-3" />
                  {dashboard.viewCount}
                </span>
              </div>
            </CardContent>
          </Card>
        </Link>

        {!isArchived && onToggleFavorite && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleFavorite();
            }}
            className="absolute bottom-3 right-3 z-10 p-1 rounded-md hover:bg-accent transition-colors"
            title={
              isFavorited ? "Remover dos favoritos" : "Adicionar aos favoritos"
            }
          >
            <Star
              className={`size-4 ${
                isFavorited
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground"
              }`}
            />
          </button>
        )}

        {(isOwner || isAdmin || canCreateEmbed) && (
          <div className="absolute top-3 right-3 z-10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 bg-background/70 backdrop-blur opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100 transition-opacity"
                  onClick={(e) => e.preventDefault()}
                >
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canManageSharing && (
                  <DropdownMenuItem
                    onClick={() => setActiveDialog("sharing")}
                  >
                    <Users className="size-4 mr-2" />
                    Compartilhamento
                  </DropdownMenuItem>
                )}
                {isOwner && (
                  <>
                    <DropdownMenuItem onClick={() => setActiveDialog("rename")}>
                      <Pencil className="size-4 mr-2" />
                      Renomear
                    </DropdownMenuItem>
                    {dashboard.source === "ai" && (
                      <DropdownMenuItem asChild>
                        <Link href={`/create?edit=${dashboard.id}`}>
                          <Sparkles className="size-4 mr-2" />
                          Editar com IA
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => setActiveDialog("replace")}
                    >
                      <Upload className="size-4 mr-2" />
                      Substituir arquivo
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setActiveDialog("versions")}
                    >
                      <History className="size-4 mr-2" />
                      Versões anteriores
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setActiveDialog("analytics")}
                    >
                      <BarChart3 className="size-4 mr-2" />
                      Analytics
                    </DropdownMenuItem>
                  </>
                )}
                {(folders ?? []).length > 0 && (
                  <DropdownMenuItem onClick={() => setActiveDialog("folders")}>
                    <FolderOpen className="size-4 mr-2" />
                    Adicionar à pasta
                  </DropdownMenuItem>
                )}
                {canCreateEmbed && (
                  <DropdownMenuItem onClick={handleCopyEmbedLink}>
                    <Code className="size-4 mr-2" />
                    Copiar link de embed
                  </DropdownMenuItem>
                )}
                {isOwner && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleArchiveToggle}>
                      <Archive className="size-4 mr-2" />
                      {isArchived ? "Desarquivar" : "Arquivar"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setActiveDialog("delete")}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="size-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {activeDialog === "rename" && (
        <RenameDialog
          dashboard={dashboard}
          open
          onOpenChange={(v) => {
            if (!v) setActiveDialog(null);
          }}
        />
      )}
      {activeDialog === "sharing" && (
        <SharingDialog
          dashboard={dashboard}
          open
          onOpenChange={(v) => {
            if (!v) setActiveDialog(null);
          }}
          sharedFolders={sharedFolders}
        />
      )}
      {activeDialog === "replace" && (
        <ReplaceDialog
          dashboard={dashboard}
          open
          onOpenChange={(v) => {
            if (!v) setActiveDialog(null);
          }}
        />
      )}
      {activeDialog === "delete" && (
        <DeleteDialog
          dashboard={dashboard}
          open
          onOpenChange={(v) => {
            if (!v) setActiveDialog(null);
          }}
        />
      )}
      {activeDialog === "versions" && (
        <VersionsDialog
          dashboardId={dashboard.id}
          open
          onOpenChange={(v) => {
            if (!v) setActiveDialog(null);
          }}
        />
      )}
      {activeDialog === "analytics" && (
        <AnalyticsDialog
          dashboardId={dashboard.id}
          dashboardTitle={dashboard.title}
          open
          onOpenChange={(v) => {
            if (!v) setActiveDialog(null);
          }}
        />
      )}
      {activeDialog === "folders" && folders && (
        <FolderAssignDialog
          dashboardId={dashboard.id}
          dashboardTitle={dashboard.title}
          folders={folders}
          open
          onOpenChange={(v) => {
            if (!v) setActiveDialog(null);
          }}
        />
      )}
    </>
  );
}
