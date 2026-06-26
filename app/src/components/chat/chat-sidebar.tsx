"use client";

import { Button } from "@/components/ui/button";
import {
  Plus,
  MessageSquare,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

export interface ChatSession {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  collapsed: boolean;
  onToggle: () => void;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
}

function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ChatSidebar({
  sessions,
  activeSessionId,
  collapsed,
  onToggle,
  onNewChat,
  onSelectSession,
  onDeleteSession,
}: ChatSidebarProps) {
  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-2 px-1 border-r bg-muted/30 w-12 shrink-0">
        <Button variant="ghost" size="icon" onClick={onToggle} className="mb-2">
          <PanelLeftOpen className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onNewChat}>
          <Plus className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col border-r bg-muted/30 w-[280px] shrink-0">
      <div className="flex items-center justify-between p-3 border-b">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="size-8"
        >
          <PanelLeftClose className="size-4" />
        </Button>
        <Button onClick={onNewChat} size="sm" className="gap-1">
          <Plus className="size-3.5" />
          New Chat
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {sessions.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">
            No conversations yet.
            <br />
            Start a new chat!
          </p>
        )}
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`group flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer transition-colors ${
              activeSessionId === session.id
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50"
            }`}
            onClick={() => onSelectSession(session.id)}
          >
            <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">{session.title}</p>
              <p className="text-xs text-muted-foreground">
                {formatRelativeDate(session.updatedAt)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 opacity-0 group-hover:opacity-100 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteSession(session.id);
              }}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
