"use client";

import { useState } from "react";
import {
  Bookmark,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  LoaderCircle,
  Pause,
  Play,
  Redo2,
  Settings2,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Square,
  Undo2,
  Volume2,
  X,
} from "lucide-react";
import type { SpeechStatus } from "@/lib/reader/useSpeech";
import { OPENAI_VOICES, STYLES, type CheckIns, type ReadingStyle, type VoiceEngine } from "@/lib/reader/voice-options";

const RATES = [0.75, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2];

export interface VoicePanelProps {
  engine: VoiceEngine;
  style: ReadingStyle;
  checkIns: CheckIns;
  voices: SpeechSynthesisVoice[];
  voiceURI: string;
  rate: number;
  pitch: number;
  openaiVoice: string;
  openaiModel: string;
  openaiKey: string;
  onEngine: (e: VoiceEngine) => void;
  onStyle: (s: ReadingStyle) => void;
  onCheckIns: (c: CheckIns) => void;
  onVoice: (uri: string) => void;
  onRate: (rate: number) => void;
  onPitch: (pitch: number) => void;
  onOpenaiVoice: (v: string) => void;
  onOpenaiModel: (m: string) => void;
  onOpenaiKey: (k: string) => void;
  onPreview: () => void;
}

/** Bottom bar: play / pause / resume, skips, chapter progress, bookmark, voice settings. */
export function PlayerBar({
  status,
  buffering,
  supported,
  unit,
  unitCount,
  chapterTitle,
  chapterPercent,
  hasPrevChapter,
  hasNextChapter,
  onToggle,
  onStop,
  onSkip,
  onChapter,
  onSeek,
  onBookmark,
  voice,
}: {
  status: SpeechStatus;
  buffering: boolean;
  supported: boolean;
  unit: number;
  unitCount: number;
  chapterTitle: string;
  /** Share of this chapter actually listened to. */
  chapterPercent: number;
  hasPrevChapter: boolean;
  hasNextChapter: boolean;
  onToggle: () => void;
  onStop: () => void;
  onSkip: (delta: number) => void;
  onChapter: (delta: number) => void;
  onSeek: (unit: number) => void;
  onBookmark: () => void;
  voice: VoicePanelProps;
}) {
  const [open, setOpen] = useState(false);
  const pct = unitCount > 1 ? (unit / (unitCount - 1)) * 100 : 0;
  const label = status === "playing" ? "Pause" : status === "paused" ? "Resume" : "Read aloud";
  const canPlay = voice.engine === "openai" || supported;

  const iconBtn =
    "grid size-9 place-items-center rounded-full text-ink/80 transition-colors hover:bg-page hover:text-ink disabled:opacity-35";

  return (
    <div className="relative rounded-3xl border border-black/[0.05] bg-white/95 px-3 py-2.5 shadow-card backdrop-blur sm:px-4">
      <div className="flex items-center gap-2">
        <span className="w-9 text-right text-[11px] tabular-nums text-muted" title="Position in chapter">
          {unitCount ? Math.round(pct) : 0}%
        </span>
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
        <span className="hidden max-w-[16rem] truncate text-[11px] text-muted sm:block">
          {chapterTitle} · <span className="font-medium text-ink/70">{Math.round(chapterPercent)}% read</span>
        </span>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center">
          <button type="button" className={iconBtn} onClick={() => onChapter(-1)} disabled={!hasPrevChapter} aria-label="Previous chapter" title="Previous chapter">
            <SkipBack className="size-4" strokeWidth={1.75} />
          </button>
          <button type="button" className={iconBtn} onClick={() => onSkip(-1)} aria-label="Previous sentence" title="Previous sentence">
            <Undo2 className="size-4" strokeWidth={1.75} />
          </button>
          <button type="button" className={`${iconBtn} hidden sm:grid`} onClick={onBookmark} aria-label="Stop here (bookmark)" title="Stop here: save a bookmark">
            <Bookmark className="size-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggle}
            disabled={!canPlay || unitCount === 0}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-ink pl-4 pr-5 text-sm font-medium text-white shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
            title="Space"
          >
            {buffering ? (
              <LoaderCircle className="size-4 animate-spin" strokeWidth={2} />
            ) : status === "playing" ? (
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
          <button type="button" className={`${iconBtn} sm:hidden`} onClick={onBookmark} aria-label="Stop here (bookmark)">
            <Bookmark className="size-4" strokeWidth={1.75} />
          </button>
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
            aria-label="Voice, style and speed"
          >
            <span className="tabular-nums">{voice.rate}×</span>
            <Settings2 className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {!canPlay && (
        <p className="mt-1 text-center text-xs text-[#8a3d12]">This browser cannot read aloud. Choose the OpenAI voice in settings.</p>
      )}

      {open && <VoicePanel {...voice} onClose={() => setOpen(false)} />}
    </div>
  );
}

function VoicePanel(p: VoicePanelProps & { onClose: () => void }) {
  const [showKey, setShowKey] = useState(false);
  const english = p.voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const others = p.voices.filter((v) => !v.lang.toLowerCase().startsWith("en"));
  const pill = (active: boolean) =>
    `rounded-full border px-2.5 py-1 text-xs transition-colors ${active ? "border-ink bg-ink text-white" : "border-line text-muted hover:text-ink"}`;

  return (
    <div className="absolute bottom-full right-0 z-30 mb-2 max-h-[min(36rem,calc(100dvh-8rem))] w-[min(24rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Voice &amp; style</p>
        <button type="button" onClick={p.onClose} className="grid size-7 place-items-center rounded-full text-muted hover:bg-page" aria-label="Close">
          <X className="size-4" strokeWidth={1.75} />
        </button>
      </div>

      {/* Engine */}
      <p className="mt-3 text-xs font-medium text-ink/80">Voice</p>
      <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-2xl border border-line bg-page/60 p-1">
        {(
          [
            ["device", "Device voice", "Free · works offline"],
            ["openai", "OpenAI voice", "Most natural · uses your key"],
          ] as const
        ).map(([id, title, hint]) => (
          <button
            key={id}
            type="button"
            onClick={() => p.onEngine(id)}
            aria-pressed={p.engine === id}
            className={`rounded-xl px-2.5 py-2 text-left transition-colors ${p.engine === id ? "bg-ink text-white" : "text-ink/80 hover:bg-white"}`}
          >
            <span className="block text-xs font-medium">{title}</span>
            <span className={`block text-[10.5px] ${p.engine === id ? "text-white/70" : "text-muted"}`}>{hint}</span>
          </button>
        ))}
      </div>

      {p.engine === "openai" ? (
        <div className="mt-3 space-y-3 rounded-2xl border border-line p-3">
          <div>
            <label htmlFor="openai-key" className="flex items-center gap-1.5 text-xs font-medium text-ink/80">
              <KeyRound className="size-3.5" strokeWidth={1.75} aria-hidden /> OpenAI API key
            </label>
            <div className="mt-1.5 flex items-center gap-1 rounded-full border border-line bg-white pl-3 pr-1 focus-within:border-black/30">
              <input
                id="openai-key"
                type={showKey ? "text" : "password"}
                value={p.openaiKey}
                onChange={(e) => p.onOpenaiKey(e.target.value)}
                placeholder="sk-…"
                autoComplete="off"
                spellCheck={false}
                className="h-8 min-w-0 flex-1 bg-transparent font-mono text-xs outline-none placeholder:font-sans"
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="grid size-7 place-items-center rounded-full text-muted hover:bg-page"
                aria-label={showKey ? "Hide key" : "Show key"}
              >
                {showKey ? <EyeOff className="size-3.5" strokeWidth={1.75} /> : <Eye className="size-3.5" strokeWidth={1.75} />}
              </button>
            </div>
            <p className="mt-1.5 flex items-start gap-1 text-[10.5px] leading-relaxed text-muted">
              <ShieldCheck className="mt-px size-3 shrink-0" strokeWidth={1.75} aria-hidden />
              Kept in this tab only and sent just to this app&apos;s server to make the audio. Clips are saved in this
              browser, so re-listening costs nothing. Leave empty if the server has OPENAI_API_KEY set.
            </p>
          </div>
          <div>
            <label htmlFor="openai-voice" className="text-xs font-medium text-ink/80">
              Narrator
            </label>
            <div className="mt-1.5 flex gap-1.5">
              <select
                id="openai-voice"
                value={p.openaiVoice}
                onChange={(e) => p.onOpenaiVoice(e.target.value)}
                className="h-9 min-w-0 flex-1 rounded-xl border border-line bg-white px-2 text-sm outline-none focus:border-black/30"
              >
                {OPENAI_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
              <button type="button" onClick={p.onPreview} className="inline-flex items-center gap-1 rounded-xl border border-line px-2.5 text-xs hover:border-black/20">
                <Volume2 className="size-3.5" strokeWidth={1.75} aria-hidden /> Try
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="openai-model" className="text-xs font-medium text-ink/80">
              Model
            </label>
            <input
              id="openai-model"
              value={p.openaiModel}
              onChange={(e) => p.onOpenaiModel(e.target.value.trim())}
              spellCheck={false}
              className="mt-1.5 h-8 w-full rounded-xl border border-line bg-white px-2.5 font-mono text-xs outline-none focus:border-black/30"
            />
            <p className="mt-1 text-[10.5px] text-muted">gpt-4o-mini-tts follows the reading style. tts-1 models ignore it.</p>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <label className="flex items-center gap-1.5 text-xs font-medium text-ink/80" htmlFor="voice">
            <Volume2 className="size-3.5" strokeWidth={1.75} aria-hidden /> Device voice
          </label>
          <select
            id="voice"
            value={p.voiceURI}
            onChange={(e) => p.onVoice(e.target.value)}
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
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted">
            Edge and Chrome have the best free voices (“Natural”, “Online”, “Google”).
          </p>
        </div>
      )}

      {/* Style */}
      <p className="mt-4 text-xs font-medium text-ink/80">Reading style</p>
      <div className="mt-1.5 grid grid-cols-3 gap-1">
        {STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => p.onStyle(s.id)}
            aria-pressed={p.style === s.id}
            title={s.hint}
            className={`rounded-xl border px-2 py-1.5 text-xs ${p.style === s.id ? "border-ink bg-ink text-white" : "border-line text-ink/80 hover:border-black/20"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <p className="mt-1 text-[10.5px] text-muted">{STYLES.find((s) => s.id === p.style)?.hint}</p>

      {/* Teacher check-ins */}
      <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-ink/80">
        <GraduationCap className="size-3.5" strokeWidth={1.75} aria-hidden /> Teacher explains
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {(
          [
            ["off", "Off"],
            ["page", "After each page"],
            ["chapter", "End of chapter"],
          ] as const
        ).map(([id, text]) => (
          <button key={id} type="button" onClick={() => p.onCheckIns(id)} aria-pressed={p.checkIns === id} className={pill(p.checkIns === id)}>
            {text}
          </button>
        ))}
      </div>
      <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
        Reading pauses and the AI from Ask settings explains what you just heard, then carries on.
      </p>

      {/* Speed */}
      <p className="mt-4 text-xs font-medium text-ink/80">Speed</p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {RATES.map((r) => (
          <button key={r} type="button" onClick={() => p.onRate(r)} aria-pressed={p.rate === r} className={`${pill(p.rate === r)} tabular-nums`}>
            {r}×
          </button>
        ))}
      </div>

      {p.engine === "device" && (
        <>
          <label className="mt-4 flex items-center justify-between text-xs font-medium text-ink/80" htmlFor="pitch">
            Pitch <span className="tabular-nums text-muted">{p.pitch.toFixed(1)}</span>
          </label>
          <input
            id="pitch"
            type="range"
            min={0.6}
            max={1.4}
            step={0.1}
            value={p.pitch}
            onChange={(e) => p.onPitch(Number(e.target.value))}
            className="reader-range mt-2 h-1 w-full"
            style={{ ["--pct" as string]: `${((p.pitch - 0.6) / 0.8) * 100}%` }}
          />
        </>
      )}
      <p className="mt-3 text-[10.5px] text-muted">
        Shortcuts: <kbd className="font-mono">Space</kbd> play/pause · <kbd className="font-mono">←</kbd>
        <kbd className="font-mono">→</kbd> turn page
      </p>
    </div>
  );
}
