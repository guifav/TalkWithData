"use client";

import Link from "next/link";
import {
  ChevronDown,
  Compass,
  MessageSquare,
  Plus,
  Sparkles,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function CreateMenu({ hasMcpAccess }: { hasMcpAccess: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New dashboard
          <ChevronDown className="size-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>How would you like to start?</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {hasMcpAccess && (
          <DropdownMenuItem asChild className="py-2">
            <Link href="/create">
              <div className="flex items-start gap-3">
                <Sparkles className="size-4 mt-0.5 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-medium flex items-center gap-1.5">
                    Create with AI
                    <span className="inline-flex items-center rounded-full bg-purple-100 px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                      Beta
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Generate a dashboard from a brief, currently in beta
                  </span>
                </div>
              </div>
            </Link>
          </DropdownMenuItem>
        )}
        {hasMcpAccess && (
          <>
            <DropdownMenuItem asChild className="py-2">
              <Link href="/chat">
                <div className="flex items-start gap-3">
                  <MessageSquare className="size-4 mt-0.5 shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-medium">Chat with data</span>
                    <span className="text-xs text-muted-foreground">
                      Explore and build in an interactive chat
                    </span>
                  </div>
                </div>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="py-2">
              <Link href="/explore">
                <div className="flex items-start gap-3">
                  <Compass className="size-4 mt-0.5 shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-medium">Explore data</span>
                    <span className="text-xs text-muted-foreground">
                      See what your authorized MCP servers provide
                    </span>
                  </div>
                </div>
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="py-2">
          <Link href="/upload">
            <div className="flex items-start gap-3">
              <Upload className="size-4 mt-0.5 shrink-0" />
              <div className="flex flex-col">
                <span className="font-medium">Upload a file</span>
                <span className="text-xs text-muted-foreground">
                  Publish a ready HTML or ZIP file
                </span>
              </div>
            </div>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
