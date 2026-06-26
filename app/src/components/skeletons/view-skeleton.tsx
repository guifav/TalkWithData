"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function ViewSkeleton() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-background">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-5 w-48" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>
      {/* Iframe area */}
      <div className="flex-1 p-4">
        <Skeleton className="w-full h-full min-h-[calc(100vh-64px)] rounded-lg" />
      </div>
    </div>
  );
}
