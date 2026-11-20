"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, CircleStop, KeyRound, RotateCcw, Send, Sparkles, Volume2 } from "lucide-react";
import type { ChatMessage } from "@/lib/chat-types";
import { getProvider, type ProviderId } from "@/lib/providers";
import { streamAsk } from "@/lib/reader/ask";
import { Markdown } from "../Markdown";
import { SettingsCard } from "../SettingsCard";

const QUICK = [
  { label: "Summarise this chapter", prompt: "Summarise this chapter in a few short paragraphs." },
  { label: "Explain what I just heard", prompt: "Explain the passage I am at right now in simple words." },
  { label: "Quiz me", prompt: "Quiz me on this chapter. Ask me one question at a time." },
  { label: "Key ideas & characters", prompt: "List the key ideas, people or characters in this chapter, one line each." },
];

/** Ask questions about the chapter being read. Answers can be read aloud. */
export function AskPanel({
  bookTitle,
  chapterTitle,
  getContext,
  passage,
  providerId,
  model,
  apiKey,
  onProviderChange,
  onModelChange,
  onApiKeyChange,
  onSpeak,
  speakingText,
  onStopSpeaking,
  seed,
}: {
  bookTitle: string;
  chapterTitle: string;
  getContext: () => string;
  passage: string;
  providerId: ProviderId;
  model: string;
  apiKey: string;
  onProviderChange: (p: ProviderId) => void;
  onModelChange: (m: string) => void;
  onApiKeyChange: (k: string) => void;
  onSpeak: (text: string) => void;
  speakingText: string | null;
  onStopSpeaking: () => void;
  /** A question sent from elsewhere (e.g. "Ask AI" on a selected word). */
  seed: { text: string; n: number } | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const provider = getProvider(providerId)!;

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const history = messages.length >= 18 ? messages.slice(-16) : messages;
    const outgoing: ChatMessage[] = [...history, { role: "user", text: q }];
    setMessages([...outgoing, { role: "model", text: "" }]);
    setDraft("");
    setError(null);
    setBusy(true);
    const controller = new AbortController();
    abort.current = controller;
    let answer = "";
    try {
      for await (const chunk of streamAsk(
        { provider: providerId, model, task: "ask", bookTitle, chapterTitle, context: getContext(), passage, messages: outgoing },
        apiKey,
        controller.signal,
      )) {
        answer += chunk;
        setMessages([...outgoing, { role: "model", text: answer }]);
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
        if (/key/i.test(String(e))) setShowSettings(true);
      }
      if (!answer) setMessages(history);
      else setMessages([...outgoing, { role: "model", text: answer }]);
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  // Questions handed over from the book (selected text → Ask AI).
  const lastSeed = useRef(0);
  useEffect(() => {
    if (seed && seed.n !== lastSeed.current) {
      lastSeed.current = seed.n;
      void send(seed.text);
    }
    // send uses current state; we only react to a new seed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="size-4" strokeWidth={1.75} aria-hidden /> Ask about this chapter
          </h2>
          <p className="truncate text-[11px] text-muted">
            {provider.label} · {provider.models.find((m) => m.id === model)?.label ?? model}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                abort.current?.abort();
                setMessages([]);
                setError(null);
              }}
              className="grid size-8 place-items-center rounded-full text-muted hover:bg-page hover:text-ink"
              aria-label="Clear conversation"
              title="Clear conversation"
            >
              <RotateCcw className="size-4" strokeWidth={1.75} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowSettings((s) => !s)}
            aria-expanded={showSettings}
            className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:text-ink"
          >
            <KeyRound className="size-3.5" strokeWidth={1.75} aria-hidden /> AI settings
            <ChevronRight className={`size-3.5 transition-transform ${showSettings ? "rotate-90" : ""}`} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <div ref={list} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {showSettings && (
          <div className="-mx-1">
            <SettingsCard
              provider={providerId}
              onProviderChange={onProviderChange}
              apiKey={apiKey}
              onApiKeyChange={onApiKeyChange}
              model={model}
              onModelChange={onModelChange}
              disabled={busy}
            />
          </div>
        )}

        {messages.length === 0 && (
          <div className="rounded-2xl bg-page/70 p-4">
            <p className="text-sm leading-relaxed text-ink/80">
              Ask anything about <span className="font-medium">{chapterTitle}</span>. The AI sees this chapter&apos;s text
              and the sentence you are at.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {QUICK.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => void send(q.prompt)}
                  className="rounded-full border border-line bg-white px-3 py-1.5 text-xs hover:border-black/20"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-8 rounded-2xl rounded-br-md bg-ink px-3.5 py-2.5 text-sm text-white">
              {m.text}
            </div>
          ) : (
            <div key={i} className="mr-4 rounded-2xl rounded-bl-md border border-line bg-white px-3.5 py-2.5">
              <div className={`markdown ${busy && i === messages.length - 1 ? "stream-caret" : ""}`}>
                <Markdown text={m.text} />
              </div>
              {m.text && !(busy && i === messages.length - 1) && (
                <button
                  type="button"
                  onClick={() => (speakingText === m.text ? onStopSpeaking() : onSpeak(m.text))}
                  className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-muted hover:bg-page hover:text-ink"
                >
                  {speakingText === m.text ? (
                    <>
                      <CircleStop className="size-3.5" strokeWidth={1.75} aria-hidden /> Stop
                    </>
                  ) : (
                    <>
                      <Volume2 className="size-3.5" strokeWidth={1.75} aria-hidden /> Read answer aloud
                    </>
                  )}
                </button>
              )}
            </div>
          ),
        )}
        {error && (
          <p role="alert" className="rounded-2xl border border-[#f1c9b0] bg-[#fdf1e9] px-3.5 py-2.5 text-sm text-[#8a3d12]">
            {error}
          </p>
        )}
      </div>

      <form
        className="border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <div className="flex items-end gap-2 rounded-2xl border border-line bg-white p-1.5 pl-3 focus-within:border-black/30">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(draft);
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder="Ask a question about the book…"
            className="max-h-32 min-h-9 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted/70"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => abort.current?.abort()}
              className="grid size-9 place-items-center rounded-full bg-page text-ink"
              aria-label="Stop answer"
            >
              <CircleStop className="size-4" strokeWidth={1.75} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!draft.trim()}
              className="grid size-9 place-items-center rounded-full bg-ink text-white disabled:opacity-30"
              aria-label="Send"
            >
              <Send className="size-4" strokeWidth={1.75} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
