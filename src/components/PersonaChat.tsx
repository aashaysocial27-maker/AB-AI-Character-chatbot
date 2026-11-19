"use client";

import { useRef, useState } from "react";
import { Info, MessagesSquare } from "lucide-react";
import type { ChatMessage, ChatRequestBody } from "@/lib/chat-types";
import { DEFAULT_PROVIDER, getProvider, type ProviderId } from "@/lib/providers";
import { DEFAULT_PERSONA_ID, STARTER_QUESTION, getPersona, type PersonaId } from "@/lib/personas";
import { streamChat } from "@/lib/streamChat";
import { useSessionKey } from "@/lib/useSessionKey";
import { ChatPanel } from "./ChatPanel";
import type { DisplayMessage } from "./MessageBubble";
import { ComparisonCard, type PreviousReply } from "./ComparisonCard";
import { PersonaPicker } from "./PersonaPicker";
import { RequestInspector } from "./RequestInspector";
import { SettingsCard } from "./SettingsCard";
import { SystemPromptCard } from "./SystemPromptCard";

/** The whole screen: state lives here, each panel is its own component. */
export function PersonaChat() {
  const [personaId, setPersonaId] = useState<PersonaId>(DEFAULT_PERSONA_ID);
  const [providerId, setProviderId] = useState<ProviderId>(DEFAULT_PROVIDER);
  const [model, setModel] = useState(getProvider(DEFAULT_PROVIDER)!.defaultModel);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [draft, setDraft] = useState(STARTER_QUESTION);
  const [lastQuestion, setLastQuestion] = useState(STARTER_QUESTION);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<ChatRequestBody | null>(null);
  const [previous, setPrevious] = useState<PreviousReply | null>(null);
  const [apiKey, setApiKey] = useSessionKey(providerId);
  const abortRef = useRef<AbortController | null>(null);
  // Bumped on every reset so a stream from an old conversation can't write into a new one.
  const conversationRef = useRef(0);

  const persona = getPersona(personaId)!;
  const provider = getProvider(providerId)!;
  const modelLabel = provider.models.find((m) => m.id === model)?.label ?? model;

  /** The API only needs role and text; strip the UI-only "via" label. */
  const toApi = (list: DisplayMessage[]): ChatMessage[] => list.map(({ role, text }) => ({ role, text }));

  function changeProvider(id: ProviderId) {
    setProviderId(id);
    setModel(getProvider(id)!.defaultModel);
    setError(null);
  }

  // Preview of the next request, shown before anything is sent.
  const preview: ChatRequestBody = {
    provider: provider.id,
    model,
    personaId: persona.id,
    systemInstruction: persona.systemInstruction,
    messages: [...toApi(messages), { role: "user", text: draft.trim() }],
  };

  async function send() {
    const text = draft.trim();
    if (!text || streaming) return;

    const before = messages;
    const outgoing: DisplayMessage[] = [...before, { role: "user", text }];
    const via = `${provider.label} ${modelLabel}`;
    const body: ChatRequestBody = {
      provider: provider.id,
      model,
      personaId: persona.id,
      systemInstruction: persona.systemInstruction,
      messages: toApi(outgoing),
    };

    const controller = new AbortController();
    abortRef.current = controller;
    const conversation = conversationRef.current;
    const isCurrent = () => conversationRef.current === conversation;
    setLastRequest(body);
    setLastQuestion(text);
    setMessages([...outgoing, { role: "model", text: "", via }]);
    setDraft("");
    setError(null);
    setStreaming(true);

    let reply = "";
    try {
      for await (const chunk of streamChat(body, apiKey, controller.signal)) {
        reply += chunk;
        const snapshot = reply;
        if (isCurrent()) setMessages([...outgoing, { role: "model", text: snapshot, via }]);
      }
      if (!reply) throw new Error(`${provider.label} returned an empty reply. Try rephrasing or another model.`);
    } catch (err) {
      if (!isCurrent()) return;
      const aborted = controller.signal.aborted;
      if (reply) {
        // Keep the partial answer so the conversation still alternates user/model.
        if (!aborted) setError("The reply was cut off. You can keep chatting or start a new chat.");
      } else {
        setMessages(before);
        setDraft(text);
        if (!aborted) setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      if (isCurrent()) setStreaming(false);
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function resetChat() {
    stop();
    conversationRef.current += 1;
    setStreaming(false);
    setMessages([]);
    setLastRequest(null);
    setError(null);
    if (!draft.trim()) setDraft(lastQuestion);
  }

  function switchPersona(id: PersonaId) {
    if (id === personaId) return;
    // Remember the latest completed answer for side-by-side comparison.
    const lastModel = [...messages].reverse().find((m) => m.role === "model" && m.text);
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastModel && lastUser) {
      setPrevious({ persona, question: lastUser.text, answer: lastModel.text, via: lastModel.via });
    }
    setPersonaId(id);
    resetChat();
  }

  return (
    <div className="relative min-h-screen">
      <div className="page-glow pointer-events-none absolute inset-x-0 top-0 h-[28rem]" aria-hidden />

      <main className="relative mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:pt-14">
        <header className="max-w-2xl">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-full bg-ink text-white">
              <MessagesSquare className="size-4" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="text-sm font-semibold tracking-tight">Persona Chat</span>
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
            Same question, different system prompt.
          </h1>
          <p className="mt-3 text-[0.95rem] leading-relaxed text-muted">
            A <strong className="font-medium text-ink">system prompt</strong> is the hidden instruction an app gives
            the model. A <strong className="font-medium text-ink">user prompt</strong> is what you type. Pick a
            character, ask a question, and watch how the instruction shapes the reply.
          </p>
          <p className="mt-4 inline-flex items-start gap-2 rounded-2xl border border-line bg-white/70 px-3.5 py-2 text-xs leading-relaxed text-muted">
            <Info className="mt-px size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
            The characters are AI simulations for teaching. They are not the real people, do not speak for them, and
            can get facts wrong.
          </p>
        </header>

        <div className="mt-10 grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-5">
            <PersonaPicker selected={persona} onSelect={switchPersona} />
            <SystemPromptCard persona={persona} />
            <SettingsCard
              provider={providerId}
              onProviderChange={changeProvider}
              apiKey={apiKey}
              onApiKeyChange={setApiKey}
              model={model}
              onModelChange={setModel}
              disabled={streaming}
            />
          </div>

          <div className="min-w-0 space-y-5">
            <ChatPanel
              persona={persona}
              messages={messages}
              draft={draft}
              onDraftChange={setDraft}
              onSend={send}
              onStop={stop}
              onReset={resetChat}
              streaming={streaming}
              error={error}
            />
            {previous && previous.persona.id !== persona.id && (
              <ComparisonCard previous={previous} onDismiss={() => setPrevious(null)} />
            )}
          </div>
        </div>

        <div className="mt-5">
          <RequestInspector request={lastRequest ?? preview} isPreview={!lastRequest} />
        </div>

        <footer className="mt-10 text-center text-xs text-muted">
          Built with Next.js · Gemini, Anthropic, OpenAI and Groq APIs · Portraits are illustrations, not photos.
        </footer>
      </main>
    </div>
  );
}
