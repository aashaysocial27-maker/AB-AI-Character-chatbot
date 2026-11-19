import { ScrollText } from "lucide-react";
import type { Persona } from "@/lib/personas";
import { Card, StepLabel } from "./Card";
import { CopyButton } from "./CopyButton";

/** Shows the entire system instruction for the selected persona. */
export function SystemPromptCard({ persona }: { persona: Persona }) {
  return (
    <Card className="p-5">
      <StepLabel
        step={2}
        title="System prompt"
        hint="Written by the app, sent with every request. The student never types this."
        action={<CopyButton text={persona.systemInstruction} />}
      />
      <div className="mt-4 rounded-2xl border border-line bg-page/60 p-4">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">
          <ScrollText className="size-3.5" strokeWidth={1.75} aria-hidden />
          systemInstruction · {persona.name}
        </p>
        <p className="whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed text-ink/85">
          {persona.systemInstruction}
        </p>
      </div>
    </Card>
  );
}
