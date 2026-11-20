import { Check, CircleAlert, Sparkles } from "lucide-react";
import type { AssistantMessage, ChatMessage } from "@/lib/chat";
import { Markdown } from "./Markdown";
import { ToolCallCard } from "./ToolCallCard";

/** The chat thread: user questions on the right, answers with their tool calls on the left. */
export function Thread({ messages }: { messages: ChatMessage[] }) {
  return (
    <ol className="space-y-6">
      {messages.map((m) =>
        m.role === "user" ? (
          <li key={m.id} className="flex justify-end">
            <p className="max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-br-lg bg-ink px-4 py-2.5 text-sm text-white">
              {m.text}
            </p>
          </li>
        ) : (
          <li key={m.id}>
            <Answer m={m} />
          </li>
        ),
      )}
    </ol>
  );
}

function Answer({ m }: { m: AssistantMessage }) {
  return (
    <div className="rounded-3xl border border-black/[0.04] bg-white p-4 shadow-card sm:p-5">
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Sparkles className="size-3.5" />
        {m.label}
        {m.calls.length > 0 && ` · ${m.calls.length} tool call${m.calls.length > 1 ? "s" : ""}`}
      </p>

      {m.running && (
        <ul className="mt-3 space-y-1.5" aria-live="polite">
          {m.steps.map((s, i) => {
            const current = i === m.steps.length - 1;
            return (
              <li key={i} className={`flex items-center gap-2 text-xs ${current ? "text-ink" : "text-muted"}`}>
                {current ? (
                  <span className="pulse-dot size-1.5 rounded-full bg-emerald-500" />
                ) : (
                  <Check className="size-3 text-emerald-600" />
                )}
                {s}
                {current && "…"}
              </li>
            );
          })}
        </ul>
      )}

      {m.calls.length > 0 && (
        <div className="mt-3 space-y-2">
          {m.calls.map((c, i) => (
            <ToolCallCard key={c.id + i} call={c} index={i} />
          ))}
        </div>
      )}

      {m.answer && (
        <div className="markdown mt-4">
          <Markdown text={m.answer} />
        </div>
      )}

      {m.error && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-orange-50 px-3 py-2.5 text-sm text-down">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {m.error}
        </p>
      )}
      {m.stopped && !m.answer && !m.error && <p className="mt-3 text-sm text-muted">Stopped.</p>}
    </div>
  );
}
