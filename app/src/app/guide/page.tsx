"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Rocket,
  Upload,
  MessageSquare,
  Sparkles,
  Pencil,
  Database,
  FolderOpen,
  Share2,
  History,
  Shield,
} from "lucide-react";
import {
  GUIDE_SECTIONS,
  PAGE_TITLE,
  PAGE_SUBTITLE,
  type GuideSection,
} from "@/lib/guide-content";

type Lang = "pt" | "en" | "es";

const LANG_LABELS: Record<Lang, string> = {
  pt: "Português",
  en: "English",
  es: "Español",
};

const ICON_MAP: Record<string, React.ReactNode> = {
  rocket: <Rocket className="size-4" />,
  upload: <Upload className="size-4" />,
  "message-square": <MessageSquare className="size-4" />,
  sparkles: <Sparkles className="size-4" />,
  pencil: <Pencil className="size-4" />,
  database: <Database className="size-4" />,
  folder: <FolderOpen className="size-4" />,
  share: <Share2 className="size-4" />,
  history: <History className="size-4" />,
  shield: <Shield className="size-4" />,
};

function renderContent(text: string) {
  // Split into paragraphs and render with basic markdown-like formatting
  const paragraphs = text.trim().split("\n\n");

  return paragraphs.map((paragraph, i) => {
    const lines = paragraph.split("\n");

    // Check if it's a bullet list
    if (lines.every((l) => l.startsWith("• ") || l.trim() === "")) {
      return (
        <ul key={i} className="space-y-1.5 my-3">
          {lines
            .filter((l) => l.startsWith("• "))
            .map((line, j) => (
              <li key={j} className="flex gap-2 text-sm text-muted-foreground">
                <span className="text-muted-foreground/60 shrink-0">•</span>
                <span
                  dangerouslySetInnerHTML={{
                    __html: formatInline(line.slice(2)),
                  }}
                />
              </li>
            ))}
        </ul>
      );
    }

    // Regular paragraph
    return (
      <p
        key={i}
        className="text-sm text-muted-foreground my-2 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: formatInline(paragraph) }}
      />
    );
  });
}

function formatInline(text: string): string {
  // Bold: **text**
  let result = text.replace(
    /\*\*(.+?)\*\*/g,
    '<strong class="text-foreground font-medium">$1</strong>'
  );
  // Code: `text`
  result = result.replace(
    /`(.+?)`/g,
    '<code class="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">$1</code>'
  );
  return result;
}

function SidebarNav({
  sections,
  lang,
  activeId,
  onSelect,
}: {
  sections: GuideSection[];
  lang: Lang;
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav className="space-y-0.5">
      {sections.map((section) => (
        <button
          key={section.id}
          onClick={() => onSelect(section.id)}
          className={`flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm transition-colors text-left ${
            activeId === section.id
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          }`}
        >
          {ICON_MAP[section.icon]}
          <span className="truncate">{section.title[lang]}</span>
        </button>
      ))}
    </nav>
  );
}

export default function GuidePage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("pt");
  const [activeSection, setActiveSection] = useState(GUIDE_SECTIONS[0].id);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  const scrollToSection = useCallback((id: string) => {
    setActiveSection(id);
    const el = document.getElementById(`section-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // Track active section on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id.replace("section-", "");
            setActiveSection(id);
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );

    for (const section of GUIDE_SECTIONS) {
      const el = document.getElementById(`section-${section.id}`);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  if (loading || !isAuthenticated) {
    return null;
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {PAGE_TITLE[lang]}
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                {PAGE_SUBTITLE[lang]}
              </p>
            </div>
            {/* Language selector */}
            <div className="flex items-center gap-1 rounded-lg border p-1">
              {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
                <Button
                  key={l}
                  variant={lang === l ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setLang(l)}
                  className="text-xs h-7 px-3"
                >
                  {l.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Main content with sidebar */}
        <div className="flex gap-8">
          {/* Sidebar - hidden on mobile */}
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-4">
              <SidebarNav
                sections={GUIDE_SECTIONS}
                lang={lang}
                activeId={activeSection}
                onSelect={scrollToSection}
              />
            </div>
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-6 pb-16">
            {GUIDE_SECTIONS.map((section) => (
              <Card key={section.id} id={`section-${section.id}`}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex items-center justify-center size-8 rounded-md bg-accent">
                      {ICON_MAP[section.icon]}
                    </span>
                    <h2 className="text-lg font-semibold">
                      {section.title[lang]}
                    </h2>
                  </div>
                  <div>{renderContent(section.content[lang])}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
