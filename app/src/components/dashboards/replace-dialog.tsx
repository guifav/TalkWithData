"use client";

import { useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
// Thumbnail generation disabled — see issue #55 (Puppeteer Cloud Function)
import { authFetch } from "@/lib/firebase/auth";
import type { Dashboard } from "@/lib/types";
import { Upload, X, FileText } from "lucide-react";

const MAX_HTML_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ZIP_SIZE = 50 * 1024 * 1024;  // 50MB

interface ReplaceDialogProps {
  dashboard: Dashboard;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReplaceDialog({ dashboard, open, onOpenChange }: ReplaceDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFile = useCallback((f: File) => {
    const isHtml = f.name.endsWith(".html");
    const isZip = f.name.endsWith(".zip");
    if (!isHtml && !isZip) {
      toast.error("Only .html and .zip files are accepted");
      return;
    }
    const maxSize = isZip ? MAX_ZIP_SIZE : MAX_HTML_SIZE;
    if (f.size > maxSize) {
      toast.error(`File size exceeds ${isZip ? "50MB" : "10MB"} limit`);
      return;
    }
    setFile(f);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleReplace = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      // Preserve the existing entrypoint for multi-page ZIP replacements
      if (file.name.endsWith(".zip") && dashboard.entrypoint) {
        formData.append("entrypoint", dashboard.entrypoint);
      }

      const res = await authFetch(`/api/dashboards/${dashboard.id}/replace`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Replace failed");
      }

      // Thumbnail generation disabled — see issue #55 (Puppeteer Cloud Function).

      toast.success("File replaced successfully");
      setFile(null);
      onOpenChange(false);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Replace failed";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setFile(null); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replace File</DialogTitle>
          <DialogDescription>
            Current file: {dashboard.fileName}
          </DialogDescription>
        </DialogHeader>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }`}
        >
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileText className="size-8 text-muted-foreground" />
              <div className="text-left">
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="size-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drag and drop an HTML or ZIP file here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                Max file size: 10MB (HTML) or 50MB (ZIP)
              </p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.zip"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setFile(null); onOpenChange(false); }}>
            Cancel
          </Button>
          <Button onClick={handleReplace} disabled={!file || uploading}>
            {uploading ? "Replacing..." : "Replace File"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
