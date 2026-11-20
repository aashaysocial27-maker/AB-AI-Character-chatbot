"use client";

import { useState, type PointerEvent } from "react";
import { ChartCandlestick, ChartLine } from "lucide-react";
import { fmtCompact, fmtDate, fmtPrice, fmtSigned } from "@/lib/format";
import type { HistoryBar } from "@/lib/types";

const W = 600;
const PRICE_H = 160;
const GAP = 12;
const VOL_H = 44;
const H = PRICE_H + GAP + VOL_H;

/** Small trading chart: candles or a line, volume bars and a hover read-out. */
export function PriceChart({ bars, currency }: { bars: HistoryBar[]; currency: string | null }) {
  const [mode, setMode] = useState<"candles" | "line">("candles");
  const [hover, setHover] = useState<number | null>(null);

  const lo = Math.min(...bars.map((b) => b.low));
  const hi = Math.max(...bars.map((b) => b.high));
  const pad = (hi - lo) * 0.08 || hi * 0.01 || 1;
  const [min, max] = [lo - pad, hi + pad];
  const maxVol = Math.max(1, ...bars.map((b) => b.volume ?? 0));
  const step = W / bars.length;
  const x = (i: number) => step * i + step / 2;
  const y = (v: number) => PRICE_H - ((v - min) / (max - min)) * PRICE_H;
  const bodyW = Math.max(2, step * 0.6);

  const i = hover ?? bars.length - 1;
  const bar = bars[i];
  const prev = i > 0 ? bars[i - 1].close : null;
  const first = bars[0].close;
  const last = bars[bars.length - 1].close;
  const monthChange = ((last - first) / first) * 100;
  const up = (b: HistoryBar) => b.close >= b.open;

  function onMove(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const idx = Math.floor(((e.clientX - rect.left) / rect.width) * bars.length);
    setHover(Math.min(bars.length - 1, Math.max(0, idx)));
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted">
            {fmtDate(bar.date)} {hover === null && "· latest"}
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight">
            {fmtPrice(bar.close, currency)}
            {prev !== null && (
              <span className={`ml-2 text-sm font-medium ${bar.close >= prev ? "text-up" : "text-down"}`}>
                {fmtSigned(((bar.close - prev) / prev) * 100, "%")}
              </span>
            )}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-muted tabular-nums">
            O {fmtPrice(bar.open)} · H {fmtPrice(bar.high)} · L {fmtPrice(bar.low)} · V {fmtCompact(bar.volume)}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-black/[0.04] p-0.5">
          {(["candles", "line"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              aria-label={m === "candles" ? "Candles" : "Line"}
              className={`grid size-7 place-items-center rounded-full transition ${
                mode === m ? "bg-white shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {m === "candles" ? <ChartCandlestick className="size-3.5" /> : <ChartLine className="size-3.5" />}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-52 w-full touch-none select-none"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={`Daily prices, ${fmtDate(bars[0].date)} to ${fmtDate(bars[bars.length - 1].date)}`}
        >
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={0} x2={W} y1={PRICE_H * f} y2={PRICE_H * f} stroke="#ecebe7" vectorEffect="non-scaling-stroke" />
          ))}

          {mode === "candles" ? (
            bars.map((b, k) => {
              const color = up(b) ? "var(--color-up)" : "var(--color-down)";
              const top = y(Math.max(b.open, b.close));
              return (
                <g key={b.date} opacity={hover === null || hover === k ? 1 : 0.55}>
                  <line x1={x(k)} x2={x(k)} y1={y(b.high)} y2={y(b.low)} stroke={color} vectorEffect="non-scaling-stroke" />
                  <rect
                    x={x(k) - bodyW / 2}
                    y={top}
                    width={bodyW}
                    height={Math.max(1, y(Math.min(b.open, b.close)) - top)}
                    fill={color}
                    rx={1}
                  />
                </g>
              );
            })
          ) : (
            <>
              <path
                d={`M${bars.map((b, k) => `${x(k)},${y(b.close)}`).join("L")}L${x(bars.length - 1)},${PRICE_H}L${x(0)},${PRICE_H}Z`}
                fill={monthChange >= 0 ? "var(--color-up)" : "var(--color-down)"}
                opacity={0.08}
              />
              <polyline
                points={bars.map((b, k) => `${x(k)},${y(b.close)}`).join(" ")}
                fill="none"
                stroke={monthChange >= 0 ? "var(--color-up)" : "var(--color-down)"}
                strokeWidth={2}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}

          {bars.map((b, k) => {
            const h = ((b.volume ?? 0) / maxVol) * VOL_H;
            return (
              <rect
                key={`v${b.date}`}
                x={x(k) - bodyW / 2}
                y={H - h}
                width={bodyW}
                height={h}
                fill={hover === k ? "#16161a" : "#d6d4cd"}
                rx={1}
              />
            );
          })}

          {hover !== null && (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={0}
              y2={H}
              stroke="#16161a"
              strokeDasharray="3 3"
              opacity={0.35}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        <span className="pointer-events-none absolute right-0 top-0 rounded bg-white/80 px-1 font-mono text-[10px] text-muted">
          {fmtPrice(max)}
        </span>
        <span className="pointer-events-none absolute right-0 top-[8.6rem] rounded bg-white/80 px-1 font-mono text-[10px] text-muted">
          {fmtPrice(min)}
        </span>
      </div>

      <div className="mt-1 flex justify-between text-[11px] text-muted">
        <span>{fmtDate(bars[0].date)}</span>
        <span className={monthChange >= 0 ? "text-up" : "text-down"}>
          {fmtSigned(monthChange, "%")} over {bars.length} trading days
        </span>
        <span>{fmtDate(bars[bars.length - 1].date)}</span>
      </div>
    </div>
  );
}
