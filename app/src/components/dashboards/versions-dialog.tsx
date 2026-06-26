"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/firebase/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, RotateCcw, Loader2, History } from "lucide-react";
import { toast } from "sonner";

interface Version {
  id: string;
  versionNumber: number;
  fileName: string;
  fileSizeBytes: number;
  replacedAt: { _seconds: number } | string;
  replacedByEmail: string;
}

function formatVersionDate(ts: { _seconds: number } | string): string {
  if (!ts) return "";
  const date =
    typeof ts === "string"
      ? new Date(ts)
      : new Date(
          (ts as { _seconds: number })._seconds * 1000
        );
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function VersionsDialog({
  dashboardId,
  open,
  onOpenChange,
}: {
  dashboardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);

    authFetch(`/api/dashboards/${dashboardId}/versions`)
      .then((res) => res.json())
      .then((data) => {
        setVersions(data.versions || []);
      })
      .catch(() => toast.error("Failed to load versions"))
      .finally(() => setLoading(false));
  }, [dashboardId, open]);

  const handleRestore = async (versionId: string) => {
    setRestoring(versionId);
    try {
      const res = await authFetch(
        `/api/dashboards/${dashboardId}/versions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ versionId }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Restore failed");
      }
      toast.success("Version restored successfully");
      onOpenChange(false);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Restore failed";
      toast.error(msg);
    } finally {
      setRestoring(null);
    }
  };

  const handleView = (versionId: string) => {
    window.open(
      `/api/dashboards/${dashboardId}/versions/${versionId}/view`,
      "_blank"
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-5" />
            Previous Versions
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center">
            <Loader2 className="size-5 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : versions.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>No previous versions available.</p>
            <p className="text-sm mt-1">
              Versions are created each time you replace the HTML file.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {versions.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs shrink-0">
                      v{v.versionNumber}
                    </Badge>
                    <span className="text-sm truncate">{v.fileName}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{formatVersionDate(v.replacedAt)}</span>
                    <span>{formatSize(v.fileSizeBytes)}</span>
                    <span className="truncate">{v.replacedByEmail}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => handleView(v.id)}
                    title="View this version"
                  >
                    <ExternalLink className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => handleRestore(v.id)}
                    disabled={restoring !== null}
                    title="Restore this version"
                  >
                    {restoring === v.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RotateCcw className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
