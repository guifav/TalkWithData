"use client";

import { useEffect, useRef } from "react";
import { formatMarkdown } from "@/lib/format-markdown";
import { User, Bot, Loader2, Wrench, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: Array<{ name: string; status: string }>;
  timestamp: string;
}

interface ChatMessagesProps {
  messages: ChatMessage[];
  isGenerating: boolean;
  streamingText: string;
  activeToolCalls: Array<{ name: string; status: string }>;
  currentHtml: string | null;
  onSaveDashboard: () => void;
}

function MessageContent({ content }: { content: string }) {
  const html = formatMarkdown(content);
  return (
    <div
      className="chat-markdown prose prose-sm dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function ToolCallIndicator({
  toolCalls,
}: {
  toolCalls: Array<{ name: string; status: string }>;
}) {
  if (toolCalls.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {toolCalls.map((tc, i) => (
        <span
          key={`${tc.name}-${i}`}
          className="inline-flex items-center gap-1 text-xs bg-muted rounded-full px-2.5 py-1"
        >
          <Wrench className="size-3" />
          <span className="font-mono">{tc.name}</span>
          {tc.status === "calling" && (
            <Loader2 className="size-3 animate-spin" />
          )}
          {tc.status === "done" && (
            <span className="text-green-600 dark:text-green-400">✓</span>
          )}
        </span>
      ))}
    </div>
  );
}

export function ChatMessages({
  messages,
  isGenerating,
  streamingText,
  activeToolCalls,
  currentHtml,
  onSaveDashboard,
}: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText, activeToolCalls]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {messages.length === 0 && !isGenerating && (
          <div className="text-center py-16 space-y-3">
            <Bot className="size-12 mx-auto text-muted-foreground/50" />
            <h2 className="text-xl font-semibold">Chat with your data</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Ask questions about internal data, explore metrics, and create
              dashboards from your conversations.
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className="flex gap-3">
            <div className="shrink-0 mt-0.5">
              {msg.role === "user" ? (
                <div className="size-7 rounded-full bg-foreground text-background flex items-center justify-center">
                  <User className="size-4" />
                </div>
              ) : (
                <div className="size-7 rounded-full bg-muted flex items-center justify-center">
                  <Bot className="size-4" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <ToolCallIndicator toolCalls={msg.toolCalls} />
              )}
              {msg.role === "user" ? (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <MessageContent content={msg.content} />
              )}
            </div>
          </div>
        ))}

        {/* Streaming assistant message */}
        {isGenerating && (
          <div className="flex gap-3">
            <div className="shrink-0 mt-0.5">
              <div className="size-7 rounded-full bg-muted flex items-center justify-center">
                <Bot className="size-4" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              {activeToolCalls.length > 0 && (
                <ToolCallIndicator toolCalls={activeToolCalls} />
              )}
              {streamingText ? (
                <MessageContent content={streamingText} />
              ) : (
                activeToolCalls.length === 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Thinking...
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* Dashboard preview */}
        {currentHtml && !isGenerating && (
          <div className="border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-muted border-b">
              <span className="text-sm font-medium">Dashboard Preview</span>
              <Button size="sm" onClick={onSaveDashboard} className="gap-1.5">
                <Save className="size-3.5" />
                Save as Dashboard
              </Button>
            </div>
            <iframe
              srcDoc={currentHtml}
              className="w-full h-[400px] bg-white"
              sandbox="allow-scripts"
              title="Dashboard preview"
            />
          </div>
        )}
      </div>
    </div>
  );
}
