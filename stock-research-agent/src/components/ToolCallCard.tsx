"use client";

import { useState } from "react";
import { Braces, ChartCandlestick, ChevronDown, CircleAlert, Clock, Loader, Search, TrendingUp } from "lucide-react";
import type { ToolCallView } from "@/lib/chat";
import { fmtArgs } from "@/lib/format";
import { ToolResultView } from "./ToolResultView";

const ICONS = { search_stocks: Search, get_quote: TrendingUp, get_history: ChartCandlestick } as const;

/** One tool call: name, arguments and timing; opens to the readable result and raw JSON. */
export function ToolCallCard({ call, index }: { call: ToolCallView; index: number }) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState(false);
  const Icon = ICONS[call.name as keyof typeof ICONS] ?? Braces;
  const running = !call.result;
  const failed = call.result && !call.result.ok;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={running}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-black/[0.015] disabled:cursor-default"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-black/[0.04]">
          <Icon className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm">
            <span className="text-[11px] text-muted tabular-nums">{index + 1}</span>
            <span className="font-mono font-medium">{call.name}</span>
          </span>
          <span className="block truncate font-mono text-[11px] text-muted">{fmtArgs(call.args)}</span>
        </span>
        {running ? (
          <Loader className="size-4 shrink-0 animate-spin text-muted" aria-label="Running" />
        ) : (
          <span className="flex shrink-0 items-center gap-2 text-[11px] text-muted">
            {failed && <CircleAlert className="size-3.5 text-down" aria-label="Failed" />}
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock className="size-3" />
              {call.ms} ms
            </span>
            <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} />
          </span>
        )}
      </button>

      {open && call.result && (
        <div className="border-t border-line px-3.5 py-3.5">
          <ToolResultView name={call.name} result={call.result} />
          <button
            type="button"
            onClick={() => setRaw((r) => !r)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] text-muted transition hover:text-ink"
          >
            <Braces className="size-3" />
            {raw ? "Hide raw JSON" : "Raw JSON"}
          </button>
          {raw && (
            <pre className="mt-2 max-h-72 overflow-auto rounded-xl border border-line bg-[#f8f7f3] p-3 font-mono text-[11px] leading-relaxed">
              {JSON.stringify({ name: call.name, arguments: call.args, result: call.result }, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
