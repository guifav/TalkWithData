"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/layout/app-shell";
import { UploadSkeleton } from "@/components/skeletons/upload-skeleton";
import { authFetch } from "@/lib/firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Upload, X, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useCategories } from "@/hooks/use-categories";

const MAX_HTML_SIZE = 10 * 1024 * 1024; // 10MB for single HTML
const MAX_ZIP_SIZE = 50 * 1024 * 1024;  // 50MB for ZIP packages

export default function UploadPage() {
  const { firebaseUser, isAuthenticated, loading } = useAuth();
  const { categories, loading: categoriesLoading } = useCategories();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Other");
  const [visibility, setVisibility] = useState<"team" | "specific">("team");
  const [allowedEmails, setAllowedEmails] = useState("");
  const [entrypoint, setEntrypoint] = useState("index.html");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

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
    setEntrypoint("index.html"); // Reset on every file change
    if (!title) {
      setTitle(f.name.replace(/\.(html|zip)$/, ""));
    }
  }, [title]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handlePreview = () => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    window.open(url, "_blank");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim() || !firebaseUser) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title.trim());
      formData.append("description", description.trim());
      formData.append("category", category);
      formData.append("visibility", visibility);
      if (file.name.endsWith(".zip") && entrypoint !== "index.html") {
        formData.append("entrypoint", entrypoint.trim());
      }
      if (visibility === "specific") {
        formData.append("allowedEmails", allowedEmails);
      }

      const res = await authFetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      const data = await res.json();

      // Thumbnail generation disabled — client-side foreignObject approach
      // is unreliable for HTML with external CSS/fonts. Puppeteer Cloud
      // Function will replace this (see issue #55).

      toast.success("Dashboard uploaded successfully");
      router.push("/");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  if (loading || !isAuthenticated) {
    return <UploadSkeleton />;
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Upload Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload an HTML or ZIP file to share with your team.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Drop zone */}
          <Card>
            <CardContent className="pt-6">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setEntrypoint("index.html");
                      }}
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
              {file && (
                <div className="mt-3 flex justify-end">
                  {file?.name.endsWith(".html") && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handlePreview}
                    >
                      <ExternalLink className="size-3" />
                      Preview
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
              <CardDescription>
                Add a title and description for your dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Dashboard title"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this dashboard"
                  rows={3}
                />
              </div>
              {file?.name.endsWith(".zip") && (
                <div className="space-y-2">
                  <Label htmlFor="entrypoint">Entry point file</Label>
                  <Input
                    id="entrypoint"
                    value={entrypoint}
                    onChange={(e) => setEntrypoint(e.target.value)}
                    placeholder="index.html"
                  />
                  <p className="text-xs text-muted-foreground">
                    The main HTML file inside the ZIP. Default: index.html
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={categoriesLoading}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                >
                  {categoriesLoading ? (
                    <option>Loading...</option>
                  ) : (
                    categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Visibility */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Visibility</CardTitle>
              <CardDescription>
                Choose who can see this dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    value="team"
                    checked={visibility === "team"}
                    onChange={() => setVisibility("team")}
                    className="accent-primary"
                  />
                  <span className="text-sm">All GRI team</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    value="specific"
                    checked={visibility === "specific"}
                    onChange={() => setVisibility("specific")}
                    className="accent-primary"
                  />
                  <span className="text-sm">Specific people</span>
                </label>
              </div>
              {visibility === "specific" && (
                <div className="space-y-2">
                  <Label htmlFor="emails">Email addresses</Label>
                  <Textarea
                    id="emails"
                    value={allowedEmails}
                    onChange={(e) => setAllowedEmails(e.target.value)}
                    placeholder="Enter email addresses, one per line"
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    One email per line. Only @griinstitute.org addresses.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/")}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!file || !title.trim() || uploading || categoriesLoading}>
              {uploading ? "Uploading..." : "Upload Dashboard"}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
