"use client";

import { useState } from "react";
import { Pause, Play, Redo2, Settings2, SkipBack, SkipForward, Square, Undo2, Volume2 } from "lucide-react";
import type { SpeechStatus } from "@/lib/reader/useSpeech";

const RATES = [0.75, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2];

/** Bottom bar: play / pause / resume, sentence and chapter skips, speed and voice. */
export function PlayerBar({
  status,
  supported,
  unit,
  unitCount,
  chapterTitle,
  hasPrevChapter,
  hasNextChapter,
  voices,
  voiceURI,
  rate,
  pitch,
  onToggle,
  onStop,
  onSkip,
  onChapter,
  onSeek,
  onVoice,
  onRate,
  onPitch,
}: {
  status: SpeechStatus;
  supported: boolean;
  unit: number;
  unitCount: number;
  chapterTitle: string;
  hasPrevChapter: boolean;
  hasNextChapter: boolean;
  voices: SpeechSynthesisVoice[];
  voiceURI: string;
  rate: number;
  pitch: number;
  onToggle: () => void;
  onStop: () => void;
  onSkip: (delta: number) => void;
  onChapter: (delta: number) => void;
  onSeek: (unit: number) => void;
  onVoice: (uri: string) => void;
  onRate: (rate: number) => void;
  onPitch: (pitch: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const pct = unitCount > 1 ? (unit / (unitCount - 1)) * 100 : 0;
  const label = status === "playing" ? "Pause" : status === "paused" ? "Resume" : "Read aloud";
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const others = voices.filter((v) => !v.lang.toLowerCase().startsWith("en"));

  const iconBtn =
    "grid size-9 place-items-center rounded-full text-ink/80 transition-colors hover:bg-page hover:text-ink disabled:opacity-35";

  return (
    <div className="relative rounded-3xl border border-black/[0.05] bg-white/95 px-3 py-2.5 shadow-card backdrop-blur sm:px-4">
      <div className="flex items-center gap-2">
        <span className="w-9 text-right text-[11px] tabular-nums text-muted">{unitCount ? Math.round(pct) : 0}%</span>
        <input
          type="range"
          min={0}
          max={Math.max(0, unitCount - 1)}
          value={unit}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Position in chapter"
          className="reader-range h-1 flex-1"
          style={{ ["--pct" as string]: `${pct}%` }}
        />
        <span className="hidden max-w-[14rem] truncate text-[11px] text-muted sm:block">{chapterTitle}</span>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center">
          <button type="button" className={iconBtn} onClick={() => onChapter(-1)} disabled={!hasPrevChapter} aria-label="Previous chapter" title="Previous chapter">
            <SkipBack className="size-4" strokeWidth={1.75} />
          </button>
          <button type="button" className={iconBtn} onClick={() => onSkip(-1)} aria-label="Previous sentence" title="Previous sentence">
            <Undo2 className="size-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggle}
            disabled={!supported || unitCount === 0}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-ink pl-4 pr-5 text-sm font-medium text-white shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
            title="Space"
          >
            {status === "playing" ? (
              <Pause className="size-4" fill="currentColor" strokeWidth={0} />
            ) : (
              <Play className="size-4" fill="currentColor" strokeWidth={0} />
            )}
            {label}
          </button>
          {status !== "idle" && (
            <button type="button" className={iconBtn} onClick={onStop} aria-label="Stop" title="Stop">
              <Square className="size-3.5" fill="currentColor" strokeWidth={0} />
            </button>
          )}
        </div>

        <div className="flex items-center">
          <button type="button" className={iconBtn} onClick={() => onSkip(1)} aria-label="Next sentence" title="Next sentence">
            <Redo2 className="size-4" strokeWidth={1.75} />
          </button>
          <button type="button" className={iconBtn} onClick={() => onChapter(1)} disabled={!hasNextChapter} aria-label="Next chapter" title="Next chapter">
            <SkipForward className="size-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={`${iconBtn} ml-1 w-auto gap-1 px-2.5 text-xs font-medium`}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label="Voice and speed"
          >
            <span className="tabular-nums">{rate}×</span>
            <Settings2 className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {!supported && (
        <p className="mt-1 text-center text-xs text-[#8a3d12]">This browser cannot read aloud. Try Chrome, Edge or Safari.</p>
      )}

      {open && (
        <div className="absolute bottom-full right-0 z-30 mb-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-white p-4 shadow-card">
          <label className="flex items-center gap-1.5 text-xs font-medium text-ink/80" htmlFor="voice">
            <Volume2 className="size-3.5" strokeWidth={1.75} aria-hidden /> Voice
          </label>
          <select
            id="voice"
            value={voiceURI}
            onChange={(e) => onVoice(e.target.value)}
            className="mt-1.5 h-9 w-full rounded-xl border border-line bg-white px-2 text-sm outline-none focus:border-black/30"
          >
            {english.length > 0 && (
              <optgroup label="English (most natural first)">
                {english.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} · {v.lang}
                  </option>
                ))}
              </optgroup>
            )}
            {others.length > 0 && (
              <optgroup label="Other languages">
                {others.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} · {v.lang}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
            Voices come from your device. The most natural ones are usually named “Natural”, “Online”, “Premium” or
            “Google”. Edge and Chrome have the best free ones.
          </p>

          <p className="mt-4 text-xs font-medium text-ink/80">Speed</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {RATES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onRate(r)}
                aria-pressed={rate === r}
                className={`rounded-full border px-2.5 py-1 text-xs tabular-nums ${
                  rate === r ? "border-ink bg-ink text-white" : "border-line text-muted hover:text-ink"
                }`}
              >
                {r}×
              </button>
            ))}
          </div>

          <label className="mt-4 flex items-center justify-between text-xs font-medium text-ink/80" htmlFor="pitch">
            Pitch <span className="tabular-nums text-muted">{pitch.toFixed(1)}</span>
          </label>
          <input
            id="pitch"
            type="range"
            min={0.6}
            max={1.4}
            step={0.1}
            value={pitch}
            onChange={(e) => onPitch(Number(e.target.value))}
            className="reader-range mt-2 h-1 w-full"
            style={{ ["--pct" as string]: `${((pitch - 0.6) / 0.8) * 100}%` }}
          />
          <p className="mt-3 text-[11px] text-muted">
            Shortcuts: <kbd className="font-mono">Space</kbd> play/pause · <kbd className="font-mono">←</kbd>
            <kbd className="font-mono">→</kbd> turn page
          </p>
        </div>
      )}
    </div>
  );
}
