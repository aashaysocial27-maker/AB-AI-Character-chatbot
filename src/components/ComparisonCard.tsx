import { GitCompareArrows, X } from "lucide-react";
import type { Persona } from "@/lib/personas";
import { Card } from "./Card";
import { Markdown } from "./Markdown";
import { Portrait } from "./Portrait";

export interface PreviousReply {
  persona: Persona;
  question: string;
  answer: string;
}

/** The previous character's answer, kept so the student can compare after switching. */
export function ComparisonCard({ previous, onDismiss }: { previous: PreviousReply; onDismiss: () => void }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Portrait persona={previous.persona} size={32} />
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
              <GitCompareArrows className="size-3.5 text-muted" strokeWidth={1.75} aria-hidden />
              Compare: previous character
            </p>
            <p className="text-xs text-muted">
              {previous.persona.name} (simulation) answered the same kind of question with a different system prompt.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Hide comparison"
          className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-page hover:text-ink"
        >
          <X className="size-4" strokeWidth={1.75} />
        </button>
      </div>
      <p className="mt-4 rounded-xl bg-page/70 px-3 py-2 text-xs text-ink/80">
        <span className="font-medium">Question:</span> {previous.question}
      </p>
      <div className="markdown mt-3 max-h-72 overflow-y-auto pr-1">
        <Markdown text={previous.answer} />
      </div>
    </Card>
  );
}
