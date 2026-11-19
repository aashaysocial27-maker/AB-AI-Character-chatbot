import { Braces, History, ScrollText, UserRound } from "lucide-react";
import type { ChatRequestBody } from "@/lib/chat-types";
import { getPersona } from "@/lib/personas";
import { Card, StepLabel } from "./Card";
import { CopyButton } from "./CopyButton";

/**
 * Shows exactly what the browser sent to /api/chat (and so what Gemini received):
 * the system instruction, any earlier turns, and the new user prompt.
 */
export function RequestInspector({ request, isPreview }: { request: ChatRequestBody; isPreview: boolean }) {
  const persona = getPersona(request.personaId);
  const history = request.messages.slice(0, -1);
  const userPrompt = request.messages.at(-1)?.text ?? "";
  const json = JSON.stringify(request, null, 2);

  return (
    <Card className="p-5">
      <StepLabel
        step={4}
        title="What Gemini receives"
        hint={
          isPreview
            ? "Preview of the next request. Nothing has been sent yet."
            : `The exact request sent with your last message · ${request.model}`
        }
        action={
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
              isPreview ? "bg-page text-muted" : "bg-[#e6f5ec] text-[#22744d]"
            }`}
          >
            {isPreview ? "Preview" : "Sent"}
          </span>
        }
      />

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <Block icon={ScrollText} title="System instruction" sub={`config.systemInstruction · ${persona?.name ?? ""}`}>
          <p className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-ink/85">
            {request.systemInstruction}
          </p>
        </Block>

        <Block
          icon={History}
          title="Conversation history"
          sub={`contents[0…${Math.max(history.length - 1, 0)}] · ${history.length} earlier ${history.length === 1 ? "turn" : "turns"}`}
        >
          {history.length === 0 ? (
            <p className="text-xs text-muted">None. This is the first message of the chat.</p>
          ) : (
            <ol className="space-y-2">
              {history.map((m, i) => (
                <li key={i} className="text-[12px] leading-relaxed">
                  <span className="mr-1.5 rounded-full bg-page px-1.5 py-0.5 font-mono text-[10.5px] text-muted">
                    {m.role}
                  </span>
                  <span className="whitespace-pre-wrap text-ink/80">
                    {m.text.length > 280 ? `${m.text.slice(0, 280)}…` : m.text}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Block>

        <Block icon={UserRound} title="User prompt" sub={`contents[${history.length}] · role "user"`}>
          {userPrompt ? (
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{userPrompt}</p>
          ) : (
            <p className="text-xs text-muted">Type a question to see it here.</p>
          )}
        </Block>
      </div>

      <details className="group mt-3 rounded-2xl border border-line">
        <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-2.5 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <Braces className="size-3.5" strokeWidth={1.75} aria-hidden />
            Raw request body (POST /api/chat)
          </span>
          <span className="group-open:hidden">Show</span>
          <span className="hidden group-open:inline">Hide</span>
        </summary>
        <div className="border-t border-line px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="font-mono text-[11px] text-muted">x-gemini-key: •••••••• (header, never shown or stored)</p>
            <CopyButton text={json} label="Copy JSON" />
          </div>
          <pre className="max-h-80 overflow-auto rounded-xl bg-page/70 p-3 font-mono text-[11.5px] leading-relaxed">
            {json}
          </pre>
        </div>
      </details>
    </Card>
  );
}

function Block({
  icon: Icon,
  title,
  sub,
  children,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-line bg-page/40 p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold">
        <Icon className="size-3.5" strokeWidth={1.75} />
        {title}
      </p>
      <p className="mt-0.5 font-mono text-[10.5px] text-muted">{sub}</p>
      <div className="mt-3 max-h-64 overflow-y-auto">{children}</div>
    </div>
  );
}
