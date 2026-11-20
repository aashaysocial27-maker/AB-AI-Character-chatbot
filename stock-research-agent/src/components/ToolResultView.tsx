import { CircleAlert, ExternalLink } from "lucide-react";
import { fmtCompact, fmtPrice, fmtSigned, fmtTime } from "@/lib/format";
import type { HistoryData, QuoteData, SearchData, ToolResult } from "@/lib/types";
import { PriceChart } from "./PriceChart";

/** Readable view of one tool result: a quote card, a ticker list or a chart. */
export function ToolResultView({ name, result }: { name: string; result: ToolResult }) {
  return (
    <div>
      {!result.ok ? (
        <p className="flex items-start gap-2 rounded-xl bg-orange-50 px-3 py-2.5 text-sm text-down">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {result.error}
        </p>
      ) : name === "get_quote" ? (
        <QuoteCard q={result.data as QuoteData} />
      ) : name === "search_stocks" ? (
        <Matches d={result.data as SearchData} />
      ) : name === "get_history" ? (
        <PriceChart bars={(result.data as HistoryData).bars} currency={(result.data as HistoryData).currency} />
      ) : null}

      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
        <span>{result.source}</span>
        <span>Fetched {fmtTime(result.fetchedAt)}</span>
        {result.link && (
          <a
            href={result.link}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 underline-offset-2 hover:text-ink hover:underline"
          >
            Yahoo Finance <ExternalLink className="size-3" />
          </a>
        )}
      </p>
    </div>
  );
}

function QuoteCard({ q }: { q: QuoteData }) {
  const color = (q.change ?? 0) >= 0 ? "text-up" : "text-down";
  const rows: [string, string][] = [
    ["Previous close", fmtPrice(q.previousClose)],
    ["Volume", fmtCompact(q.volume)],
    ["Market cap", fmtCompact(q.marketCap)],
    ["Market state", q.marketState ?? "—"],
  ];
  return (
    <div>
      <p className="text-xs text-muted">
        <span className="font-medium text-ink">{q.symbol}</span>
        {q.name && ` · ${q.name}`}
        {q.exchange && ` · ${q.exchange}`}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
        {fmtPrice(q.price)} <span className="text-sm font-medium text-muted">{q.currency}</span>
      </p>
      <p className={`text-sm font-medium tabular-nums ${color}`}>
        {fmtSigned(q.change)} ({fmtSigned(q.changePercent, "%")})
      </p>
      <p className="mt-1 text-[11px] text-muted">Market time {fmtTime(q.marketTime)} · may be delayed</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {rows.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-black/[0.025] px-2.5 py-2">
            <dt className="text-[11px] text-muted">{k}</dt>
            <dd className="text-sm font-medium tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Matches({ d }: { d: SearchData }) {
  if (!d.matches.length) return <p className="text-sm text-muted">No tickers matched “{d.query}”.</p>;
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
      {d.matches.map((m) => (
        <li key={m.symbol} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span className="min-w-0">
            <span className="font-mono font-medium">{m.symbol}</span>
            <span className="ml-2 truncate text-muted">{m.name}</span>
          </span>
          <span className="shrink-0 text-xs text-muted">
            {[m.exchange, m.type].filter(Boolean).join(" · ")}
          </span>
        </li>
      ))}
    </ul>
  );
}
