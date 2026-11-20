import { ChartCandlestick, Search, TrendingUp } from "lucide-react";
import { PRESETS, TOOL_INFO } from "@/lib/presets";

const ICONS = { search_stocks: Search, get_quote: TrendingUp, get_history: ChartCandlestick } as const;

/** Shown before the first message: preset questions and the three tools. */
export function EmptyState({ onPick }: { onPick: (question: string) => void }) {
  return (
    <div className="py-6">
      <p className="text-center text-xs font-medium uppercase tracking-wider text-muted">Try asking</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onPick(p.question)}
            className="inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-white px-3.5 py-1.5 text-sm shadow-sm transition hover:border-black/20"
          >
            <span className={`size-1.5 rounded-full ${p.dot}`} />
            {p.label}
          </button>
        ))}
      </div>

      <p className="mt-10 text-center text-xs font-medium uppercase tracking-wider text-muted">Tools the agent can call</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {TOOL_INFO.map((t) => {
          const Icon = ICONS[t.name];
          return (
            <div key={t.name} className="rounded-2xl border border-black/[0.04] bg-white p-4 shadow-card">
              <span className="grid size-8 place-items-center rounded-xl bg-black/[0.04]">
                <Icon className="size-4" />
              </span>
              <p className="mt-3 font-mono text-xs font-medium">{t.name}</p>
              <p className="mt-0.5 text-sm font-medium">{t.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{t.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
