import { FlaskConical } from "lucide-react";
import { PERSONAS, type Persona, type PersonaId } from "@/lib/personas";
import { Card, StepLabel } from "./Card";
import { Portrait } from "./Portrait";

export function PersonaPicker({
  selected,
  onSelect,
  disabled,
}: {
  selected: Persona;
  onSelect: (id: PersonaId) => void;
  disabled?: boolean;
}) {
  return (
    <Card className="p-5">
      <StepLabel step={1} title="Choose a character" hint="Switching starts a fresh chat but keeps your question." />

      <div role="radiogroup" aria-label="Character" className="mt-4 flex flex-wrap gap-2">
        {PERSONAS.map((p) => {
          const active = p.id === selected.id;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onSelect(p.id)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 ${
                active
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-white text-ink hover:border-black/20"
              }`}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: p.accent }} aria-hidden />
              {p.inspiredBy}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-4 rounded-2xl bg-page/70 p-4">
        <Portrait persona={selected} size={56} />
        <div className="min-w-0">
          <p className="font-semibold tracking-tight">{selected.name}</p>
          <p className="text-xs text-muted">Inspired by {selected.inspiredBy}</p>
          <p className="mt-1 text-sm text-ink/80">{selected.tagline}</p>
        </div>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
        <FlaskConical className="size-3.5" strokeWidth={1.75} aria-hidden />
        AI simulation for learning, not the real person.
      </p>
    </Card>
  );
}
