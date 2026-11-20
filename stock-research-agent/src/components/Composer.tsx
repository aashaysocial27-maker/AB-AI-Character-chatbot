"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { ArrowUp, Square } from "lucide-react";

const MAX_CHARS = 1000;

/** Message box: Enter sends, Shift+Enter adds a line, the button becomes Stop while working. */
export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  busy,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!busy && !disabled && value.trim()) onSend();
    }
  }

  return (
    <div className="flex items-end gap-2 rounded-3xl border border-black/[0.06] bg-white p-2 pl-4 shadow-card">
      <textarea
        ref={ref}
        rows={1}
        value={value}
        maxLength={MAX_CHARS}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask about a stock…"
        aria-label="Your question"
        className="max-h-40 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted"
      />
      {busy ? (
        <button
          type="button"
          onClick={onStop}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-medium text-white"
        >
          <Square className="size-3 fill-current" /> Stop
        </button>
      ) : (
        <button
          type="button"
          onClick={onSend}
          disabled={disabled || !value.trim()}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-medium text-white transition disabled:opacity-30"
        >
          <ArrowUp className="size-4" /> Send
        </button>
      )}
    </div>
  );
}
