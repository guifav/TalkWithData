"use client";

import { ReactNode } from "react";
import { UserMenu } from "./user-menu";
import { ThemeToggle } from "./theme-toggle";
import { LayoutDashboard, Shield, HelpCircle, Compass, Home } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { useMcpAccess } from "@/hooks/mcp-access-context";
import Link from "next/link";

export function AppShell({ children }: { children: ReactNode }) {
  const { isAdmin } = useRole();
  const { hasAccess: hasMcpAccess } = useMcpAccess();

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <LayoutDashboard className="size-5" />
          <span className="text-lg font-semibold">Talk With Data</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/"
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Home className="size-4" />
            <span className="hidden md:inline">Home</span>
          </Link>
          {hasMcpAccess && (
            <Link
              href="/explore"
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Compass className="size-4" />
              <span className="hidden md:inline">Explore</span>
            </Link>
          )}
          <Link
            href="/guide"
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <HelpCircle className="size-4" />
            <span className="hidden md:inline">Guide</span>
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Shield className="size-4" />
              <span className="hidden md:inline">Admin</span>
            </Link>
          )}
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
    </div>
  );
}
