"use client";

import Link from "next/link";
import {
  ArrowRight,
  Compass,
  LayoutDashboard,
  MessageSquare,
  Sparkles,
  Upload,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

type Option = {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: string;
  beta?: boolean;
};

export function HomeEmptyState({
  userName,
  hasMcpAccess,
}: {
  userName?: string | null;
  hasMcpAccess: boolean;
}) {
  const greeting = userName ? `Hello, ${userName.split(" ")[0]}` : "Welcome";

  const options: Option[] = [
    {
      href: "/upload",
      icon: <Upload className="size-5" />,
      title: "Upload a file",
      description: "Already have an HTML or ZIP file? Publish it in seconds.",
      accent: "from-blue-500/20 to-blue-500/5 text-blue-700 dark:text-blue-300",
    },
  ];

  if (hasMcpAccess) {
    options.push({
      href: "/create",
      icon: <Sparkles className="size-5" />,
      title: "Create with AI",
      description: "Describe what you need and let AI build the dashboard.",
      accent:
        "from-purple-500/20 to-purple-500/5 text-purple-700 dark:text-purple-300",
      beta: true,
    });
  }

  if (hasMcpAccess) {
    options.push(
      {
        href: "/chat",
        icon: <MessageSquare className="size-5" />,
        title: "Chat with data",
        description:
          "Use authorized MCP servers to build and refine in an interactive chat.",
        accent:
          "from-emerald-500/20 to-emerald-500/5 text-emerald-700 dark:text-emerald-300",
      },
      {
        href: "/explore",
        icon: <Compass className="size-5" />,
        title: "Explore data",
        description: "See what is already connected before you begin.",
        accent:
          "from-amber-500/20 to-amber-500/5 text-amber-700 dark:text-amber-300",
      }
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <LayoutDashboard className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">{greeting}!</h1>
          <p className="text-sm text-muted-foreground">
            You do not have any dashboards yet. Choose how to get started.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((opt) => (
          <Link key={opt.href} href={opt.href} className="group">
            <Card className="h-full hover:shadow-md transition-all hover:-translate-y-0.5">
              <CardContent className="flex gap-4 p-5">
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${opt.accent}`}
                >
                  {opt.icon}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-medium flex items-center gap-1.5">
                      {opt.title}
                      {opt.beta && (
                        <span className="inline-flex items-center rounded-full bg-purple-100 px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                          Beta
                        </span>
                      )}
                    </h3>
                    <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {opt.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
