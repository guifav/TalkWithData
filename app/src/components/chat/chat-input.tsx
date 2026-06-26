"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { SendHorizontal, Square } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  isGenerating: boolean;
  disabled?: boolean;
  /** Optional element rendered above the input (e.g. MCP selector) */
  headerSlot?: React.ReactNode;
}

export function ChatInput({
  onSend,
  onStop,
  isGenerating,
  disabled,
  headerSlot,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
    }
  }, [value]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t bg-background px-4 py-3">
      {headerSlot && (
        <div className="max-w-3xl mx-auto mb-2">{headerSlot}</div>
      )}
      <div className="max-w-3xl mx-auto flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your data..."
          disabled={disabled || isGenerating}
          rows={1}
          className="flex-1 resize-none rounded-lg border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 min-h-[40px] max-h-[200px]"
        />
        {isGenerating ? (
          <Button
            variant="destructive"
            size="icon"
            className="size-10 shrink-0"
            onClick={onStop}
          >
            <Square className="size-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            className="size-10 shrink-0"
            disabled={!value.trim() || disabled}
            onClick={handleSend}
          >
            <SendHorizontal className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
