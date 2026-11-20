"use client";

import { useEffect, useRef, useState } from "react";
import { ChartCandlestick, Plus } from "lucide-react";
import { Composer } from "@/components/Composer";
import { EmptyState } from "@/components/EmptyState";
import { SettingsBar } from "@/components/SettingsBar";
import { Thread } from "@/components/Thread";
import { applyEvent, type AssistantMessage, type ChatMessage } from "@/lib/chat";
import { PROVIDERS, getProvider, modelLabel, type ProviderId } from "@/lib/providers";
import { readEvents } from "@/lib/readStream";
import type { ChatTurn } from "@/lib/types";
import { useSessionKey } from "@/lib/useSessionKey";

const DEFAULT_MODELS = Object.fromEntries(PROVIDERS.map((p) => [p.id, p.defaultModel])) as Record<ProviderId, string>;
const newId = () => Math.random().toString(36).slice(2);

/** Earlier turns go back as plain text; failed or stopped turns are left out. */
function toTurns(messages: ChatMessage[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (let i = 0; i < messages.length - 1; i++) {
    const q = messages[i];
    const a = messages[i + 1];
    if (q.role === "user" && a.role === "assistant" && a.answer && !a.error) {
      turns.push({ role: "user", text: q.text }, { role: "assistant", text: a.answer });
    }
  }
  return turns.slice(-18);
}

export default function Page() {
  const [providerId, setProviderId] = useState<ProviderId>("gemini");
  const [models, setModels] = useState(DEFAULT_MODELS);
  const [apiKey, setApiKey] = useSessionKey(providerId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const provider = getProvider(providerId)!;
  const model = models[providerId];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const update = (id: string, fn: (m: AssistantMessage) => AssistantMessage) =>
    setMessages((all) => all.map((m) => (m.id === id && m.role === "assistant" ? fn(m) : m)));

  async function send(text = draft) {
    const question = text.trim();
    if (!question || busy) return;
    if (!apiKey) {
      setDraft(question);
      return;
    }

    const turns = [...toTurns(messages), { role: "user" as const, text: question }];
    const answerId = newId();
    setMessages((all) => [
      ...all,
      { id: newId(), role: "user", text: question },
      { id: answerId, role: "assistant", label: modelLabel(providerId, model), steps: [], calls: [], running: true },
    ]);
    setDraft("");
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json", [provider.keyHeader]: apiKey },
        body: JSON.stringify({ provider: providerId, model, messages: turns }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Request failed (${res.status}).`);
      }
      for await (const event of readEvents(res)) update(answerId, (m) => applyEvent(m, event));
      update(answerId, (m) => ({ ...m, running: false }));
    } catch (error) {
      const stopped = controller.signal.aborted;
      update(answerId, (m) => ({
        ...m,
        running: false,
        stopped,
        error: stopped ? undefined : error instanceof Error ? error.message : "Something went wrong.",
      }));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function newChat() {
    abortRef.current?.abort();
    setMessages([]);
    setDraft("");
  }

  return (
    <div className="page-glow min-h-dvh">
      <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 pt-8 sm:pt-12">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <span className="grid size-8 place-items-center rounded-xl bg-ink text-white">
                <ChartCandlestick className="size-4" />
              </span>
              AI Stock Research Agent
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
              Answers come from live Yahoo Finance data fetched with tools. Every tool call is shown, so you can see
              where each number came from. Not investment advice.
            </p>
          </div>
          <button
            type="button"
            onClick={newChat}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 text-xs font-medium text-white"
          >
            <Plus className="size-3.5" /> New chat
          </button>
        </header>

        <div className="mt-6">
          <SettingsBar
            providerId={providerId}
            model={model}
            apiKey={apiKey}
            disabled={busy}
            onProvider={setProviderId}
            onModel={(id) => setModels((m) => ({ ...m, [providerId]: id }))}
            onKey={setApiKey}
          />
        </div>

        <section className="mt-6 flex-1" aria-label="Conversation">
          {messages.length === 0 ? <EmptyState onPick={(q) => send(q)} /> : <Thread messages={messages} />}
          <div ref={endRef} />
        </section>

        <div className="sticky bottom-0 -mx-4 mt-6 bg-gradient-to-t from-page via-page/95 to-transparent px-4 pb-5 pt-4">
          {!apiKey && (
            <p className="mb-2 text-center text-xs text-muted">Add a {provider.label} API key above to start.</p>
          )}
          <Composer
            value={draft}
            onChange={setDraft}
            onSend={() => send()}
            onStop={() => abortRef.current?.abort()}
            busy={busy}
            disabled={!apiKey}
          />
          <p className="mt-2 text-center text-[11px] text-muted">
            Up to 8 tool calls per answer. Quotes may be delayed. Data: Yahoo Finance (unofficial).
          </p>
        </div>
      </main>
    </div>
  );
}
