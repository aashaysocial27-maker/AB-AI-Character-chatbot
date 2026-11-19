"use client";

import { useEffect, useRef } from "react";
import { ArrowUp, MessageSquareText, RotateCcw, Square, TriangleAlert } from "lucide-react";
import type { ChatMessage } from "@/lib/chat-types";
import type { Persona } from "@/lib/personas";
import { LIMITS, MAX_EXCHANGES } from "@/lib/limits";
import { Card, StepLabel } from "./Card";
import { MessageBubble } from "./MessageBubble";
import { Portrait } from "./Portrait";

export function ChatPanel({
  persona,
  messages,
  draft,
  onDraftChange,
  onSend,
  onStop,
  onReset,
  streaming,
  error,
}: {
  persona: Persona;
  messages: ChatMessage[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onReset: () => void;
  streaming: boolean;
  error: string | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  // Follow the stream while the reader is at the bottom; stop if they scroll up.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const exchanges = messages.filter((m) => m.role === "user").length;
  const full = exchanges >= MAX_EXCHANGES;
  const tooLong = draft.length > LIMITS.maxMessageChars;
  const canSend = !streaming && !full && !tooLong && draft.trim().length > 0;

  return (
    <Card className="flex flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <div className="flex items-center gap-3">
          <Portrait persona={persona} size={36} />
          <div>
            <p className="text-sm font-semibold tracking-tight">{persona.name}</p>
            <p className="text-xs text-muted">AI simulation inspired by {persona.inspiredBy}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={messages.length === 0}
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:text-ink disabled:opacity-40"
        >
          <RotateCcw className="size-3.5" strokeWidth={1.75} aria-hidden />
          New chat
        </button>
      </header>

      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
        className="h-[460px] space-y-5 overflow-y-auto px-5 py-5"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <div className="grid h-full place-items-center text-center">
            <div className="max-w-xs">
              <MessageSquareText className="mx-auto size-6 text-muted/60" strokeWidth={1.5} aria-hidden />
              <p className="mt-3 text-sm font-medium">No messages yet</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                The question below is ready to go. Press send, then switch character and send it again to compare.
              </p>
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <MessageBubble
              key={i}
              message={m}
              persona={persona}
              streaming={streaming && i === messages.length - 1}
            />
          ))
        )}
      </div>

      <form
        className="border-t border-line bg-page/40 px-5 pb-5 pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSend) onSend();
        }}
      >
        <StepLabel step={3} title="User prompt" hint="What the student types. Sent as the latest user turn." />

        {error && (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-[#fff4ec] px-3 py-2 text-xs text-[#9a4a17]">
            <TriangleAlert className="mt-px size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
            {error}
          </p>
        )}

        <div className="mt-3 rounded-2xl border border-line bg-white p-2 focus-within:border-black/25">
          <label htmlFor="user-prompt" className="sr-only">
            User prompt
          </label>
          <textarea
            id="user-prompt"
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (canSend) onSend();
              }
            }}
            rows={2}
            placeholder={full ? "Conversation limit reached — start a new chat." : "Ask a question…"}
            disabled={full}
            className="block w-full resize-none bg-transparent px-2 py-1.5 text-[0.925rem] leading-relaxed outline-none placeholder:text-muted/70"
          />
          <div className="flex items-center justify-between gap-2 px-1">
            <span className={`text-[11px] ${tooLong ? "text-[#b4541c]" : "text-muted/80"}`}>
              {draft.length}/{LIMITS.maxMessageChars} · {exchanges}/{MAX_EXCHANGES} turns · Enter to send
            </span>
            {streaming ? (
              <button
                type="button"
                onClick={onStop}
                className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white"
              >
                <Square className="size-3.5 fill-current" strokeWidth={1.75} aria-hidden />
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSend}
                className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-30"
              >
                Send
                <ArrowUp className="size-4" strokeWidth={2} aria-hidden />
              </button>
            )}
          </div>
        </div>
      </form>
    </Card>
  );
}
