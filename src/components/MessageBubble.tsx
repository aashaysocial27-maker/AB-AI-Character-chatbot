import { UserRound } from "lucide-react";
import type { ChatMessage } from "@/lib/chat-types";

/** A chat message plus, for replies, which provider/model wrote it. */
export type DisplayMessage = ChatMessage & { via?: string };
import type { Persona } from "@/lib/personas";
import { Markdown } from "./Markdown";
import { Portrait } from "./Portrait";

export function MessageBubble({
  message,
  persona,
  streaming,
}: {
  message: DisplayMessage;
  persona: Persona;
  streaming?: boolean;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end gap-3">
        <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-ink px-4 py-2.5 text-[0.925rem] leading-relaxed whitespace-pre-wrap text-white">
          {message.text}
        </div>
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-page text-muted" aria-hidden>
          <UserRound className="size-4" strokeWidth={1.75} />
        </span>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <Portrait persona={persona} size={32} />
      <div className="min-w-0 max-w-[85%]">
        <p className="mb-1 text-xs text-muted">
          {persona.name} <span className="text-muted/70">· simulation{message.via ? ` · ${message.via}` : ""}</span>
        </p>
        <div className="rounded-2xl rounded-tl-md border border-line bg-white px-4 py-3">
          {message.text ? (
            <div className={`markdown ${streaming ? "stream-caret" : ""}`}>
              <Markdown text={message.text} />
            </div>
          ) : (
            <span className="text-sm text-muted stream-caret">Thinking</span>
          )}
        </div>
      </div>
    </div>
  );
}
