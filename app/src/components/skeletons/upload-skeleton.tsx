"use client";

import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function UploadSkeleton() {
  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-7 w-40" />

        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            {/* File drop zone */}
            <Skeleton className="h-32 w-full rounded-lg" />
            {/* Title input */}
            <div className="space-y-2">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
            {/* Description */}
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-20 w-full rounded-md" />
            </div>
            {/* Category */}
            <div className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
            {/* Submit button */}
            <Skeleton className="h-10 w-full rounded-md" />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
