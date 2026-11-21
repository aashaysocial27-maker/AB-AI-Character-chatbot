"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { splitUnits } from "./layout";
import type { ReadingStyle, VoiceEngine } from "./voice-options";

/**
 * Read-aloud engine. Two voices behind one set of controls:
 *
 * - "device": the browser's Speech Synthesis (free, offline).
 * - "openai": OpenAI text-to-speech through /api/tts (expressive, uses the reader's key).
 *
 * Text is spoken one sentence at a time, so the page can highlight the
 * sentence being read, progress can be counted per sentence, and pause/resume
 * is exact: resuming continues from the word where it stopped.
 *
 * Reading styles shape delivery: pauses between sentences and paragraphs,
 * pace, and (on the device voice) pitch for dialogue, questions and
 * exclamations. The OpenAI voice also gets a spoken-style instruction.
 */

export type SpeechStatus = "idle" | "playing" | "paused";

export interface WordMark {
  unit: number;
  start: number;
  length: number;
}

/** Higher score = more natural-sounding voice. */
export function naturalScore(v: SpeechSynthesisVoice): number {
  const name = v.name.toLowerCase();
  let score = 0;
  if (/natural|neural|wavenet|journey|studio/.test(name)) score += 60;
  if (/premium|enhanced|siri/.test(name)) score += 45;
  if (/online/.test(name)) score += 30;
  if (/google/.test(name)) score += 25;
  if (/(ava|andrew|emma|brian|aria|jenny|guy|sonia|ryan|libby|samantha|daniel|karen|moira|serena)\b/.test(name)) score += 10;
  if (!v.localService) score += 5;
  if (/compact|espeak|novelty|whisper|bells|bahh|boing|bubbles|cellos|zarvox|trinoids|albert|jester|organ|superstar|wobble|bad news|good news/.test(name)) score -= 80;
  if (v.lang.toLowerCase().startsWith("en")) score += 20;
  if (/en[-_](us|gb)/i.test(v.lang)) score += 5;
  return score;
}

export function useVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    if (!supported) return;
    const load = () => {
      const list = window.speechSynthesis.getVoices();
      setVoices([...list].sort((a, b) => naturalScore(b) - naturalScore(a) || a.name.localeCompare(b.name)));
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [supported]);

  return { voices, supported };
}

// ---------- delivery for each reading style ----------

const DIALOGUE = /^[\s"“‘']*["“]|["”]\s*$/;

interface Delivery {
  rate: number;
  pitch: number;
  /** Silence after this unit, in ms. */
  pauseAfter: number;
}

function delivery(style: ReadingStyle, text: string, paragraphEnd: boolean, rate: number, pitch: number): Delivery {
  const t = text.trim();
  if (style === "plain") return { rate, pitch, pauseAfter: paragraphEnd ? 250 : 0 };
  if (style === "teacher") {
    return { rate: rate * 0.92, pitch, pauseAfter: paragraphEnd ? 950 : 380 };
  }
  // Storyteller
  let r = rate * 0.96;
  let p = pitch;
  if (DIALOGUE.test(t)) p += 0.14; // characters speak a little higher than the narrator
  if (/[?]["”’)]*$/.test(t)) p += 0.06;
  if (/[!]["”’)]*$/.test(t)) {
    r *= 1.05;
    p += 0.06;
  }
  if (/…|\.\.\.["”’)]*$/.test(t)) r *= 0.9;
  return { rate: r, pitch: Math.min(2, p), pauseAfter: paragraphEnd ? 750 : /[;:—]$/.test(t) ? 300 : 220 };
}

// ---------- OpenAI audio clips (cached in memory and in the browser's Cache Storage) ----------

const CACHE_NAME = "reader-tts-v1";

async function sha(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface OpenAiVoice {
  apiKey: string;
  voice: string;
  model: string;
}

async function fetchClip(text: string, style: ReadingStyle, ai: OpenAiVoice, signal?: AbortSignal): Promise<Blob> {
  const id = await sha(`${ai.model}|${ai.voice}|${style}|${text}`);
  const cacheUrl = `/__tts-cache/${id}.mp3`;
  try {
    const cached = await (await caches.open(CACHE_NAME)).match(cacheUrl);
    if (cached) return await cached.blob();
  } catch {
    // Cache Storage unavailable (private mode etc.)
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (ai.apiKey) headers["x-openai-key"] = ai.apiKey;
  const res = await fetch("/api/tts", {
    method: "POST",
    headers,
    body: JSON.stringify({ text, voice: ai.voice, model: ai.model, style }),
    signal,
  });
  if (!res.ok) {
    let message = `The OpenAI voice failed (${res.status}).`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // keep generic
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  try {
    await (await caches.open(CACHE_NAME)).put(cacheUrl, new Response(blob, { headers: { "Content-Type": "audio/mpeg" } }));
  } catch {
    // not cached; fine
  }
  return blob;
}

// ---------- the hook ----------

interface Options {
  units: string[];
  /** For each unit, true when it ends a paragraph (longer pause). */
  paragraphEnds?: boolean[];
  engine: VoiceEngine;
  style: ReadingStyle;
  voice: SpeechSynthesisVoice | null;
  rate: number;
  pitch: number;
  openai: OpenAiVoice;
  /** Called when the last unit finishes (e.g. to move to the next chapter). */
  onFinished?: () => void;
  /** Called when a unit has been heard to the end. */
  onUnitDone?: (index: number) => void;
  /** Return true to stop after unit `index` (e.g. for a teacher check-in). Reading is left paused at the next unit. */
  shouldHold?: (index: number) => boolean;
  onHold?: (index: number) => void;
  onError?: (message: string) => void;
}

export function useSpeech(options: Options) {
  const { units, engine, style, voice, rate, pitch, openai } = options;
  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [index, setIndex] = useState(0);
  const [word, setWord] = useState<WordMark | null>(null);
  const [buffering, setBuffering] = useState(false);
  /** Short text being spoken outside the book (an answer, a word, a teacher note). */
  const [aside, setAside] = useState<string | null>(null);

  const token = useRef(0);
  const indexRef = useRef(0);
  const boundary = useRef(0);
  const statusRef = useRef<SpeechStatus>("idle");
  const gapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const asideAudio = useRef<HTMLAudioElement | null>(null);
  const clips = useRef(new Map<string, Promise<string>>());
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  const setStatusBoth = (s: SpeechStatus) => {
    statusRef.current = s;
    setStatus(s);
  };

  const getAudio = () => (audio.current ??= new Audio());

  /** Blob URL for a unit's clip, fetched once and reused. */
  const clipUrl = useCallback((text: string): Promise<string> => {
    const { style: st, openai: ai } = latest.current;
    const key = `${ai.model}|${ai.voice}|${st}|${text}`;
    let p = clips.current.get(key);
    if (!p) {
      p = fetchClip(text, st, ai).then((b) => URL.createObjectURL(b));
      p.catch(() => clips.current.delete(key));
      clips.current.set(key, p);
      // Keep memory in check: forget the oldest clips.
      if (clips.current.size > 80) {
        const [oldKey, old] = clips.current.entries().next().value as [string, Promise<string>];
        clips.current.delete(oldKey);
        void old.then((u) => URL.revokeObjectURL(u)).catch(() => {});
      }
    }
    return p;
  }, []);

  const clearGap = () => {
    if (gapTimer.current) clearTimeout(gapTimer.current);
    gapTimer.current = null;
  };

  const silenceAll = () => {
    clearGap();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    audio.current?.pause();
    asideAudio.current?.pause();
  };

  const speakRef = useRef<(i: number, charOffset?: number) => void>(() => {});

  /** After unit i is heard: count it, maybe hold, then pause briefly and go on. */
  const finishUnit = (i: number, my: number) => {
    const o = latest.current;
    o.onUnitDone?.(i);
    if (i + 1 >= o.units.length) {
      speakRef.current(i + 1);
      return;
    }
    if (o.shouldHold?.(i)) {
      token.current++;
      indexRef.current = i + 1;
      boundary.current = 0;
      setIndex(i + 1);
      setWord(null);
      setStatusBoth("paused");
      o.onHold?.(i);
      return;
    }
    const d = delivery(o.style, o.units[i], o.paragraphEnds?.[i] ?? false, o.rate, o.pitch);
    const wait = o.engine === "openai" ? Math.max(0, d.pauseAfter - 150) : d.pauseAfter;
    if (wait > 0) gapTimer.current = setTimeout(() => token.current === my && speakRef.current(i + 1), wait);
    else speakRef.current(i + 1);
  };

  const speakDevice = (i: number, charOffset: number, my: number) => {
    const synth = window.speechSynthesis;
    const o = latest.current;
    const full = o.units[i];
    const text = full.slice(charOffset);
    const d = delivery(o.style, full, false, o.rate, o.pitch);
    const u = new SpeechSynthesisUtterance(text);
    if (o.voice) {
      u.voice = o.voice;
      u.lang = o.voice.lang;
    }
    u.rate = Math.max(0.5, Math.min(2.5, d.rate));
    u.pitch = d.pitch;
    u.onboundary = (e) => {
      if (token.current !== my || e.name !== "word") return;
      const start = charOffset + e.charIndex;
      boundary.current = start;
      const len = e.charLength || (full.slice(start).match(/^\S+/)?.[0].length ?? 0);
      setWord({ unit: i, start, length: len });
    };
    u.onend = () => {
      if (token.current !== my || statusRef.current !== "playing") return;
      finishUnit(i, my);
    };
    u.onerror = (e) => {
      if (token.current !== my || e.error === "interrupted" || e.error === "canceled") return;
      if (statusRef.current === "playing") finishUnit(i, my);
    };
    const start = () => {
      if (token.current === my) synth.speak(u);
    };
    if (synth.speaking || synth.pending) {
      synth.cancel();
      // Some engines drop an utterance queued in the same tick as cancel().
      setTimeout(start, 60);
    } else {
      start();
    }
  };

  const speakOpenAi = (i: number, charOffset: number, my: number) => {
    const o = latest.current;
    const full = o.units[i];
    const el = getAudio();
    const key = `${o.openai.model}|${o.openai.voice}|${o.style}|${full}`;

    const attach = () => {
      el.playbackRate = o.rate;
      el.preservesPitch = true;
      el.ontimeupdate = () => {
        if (token.current !== my || !el.duration || !isFinite(el.duration)) return;
        // No word timings from the API: estimate the word from how far the clip has played.
        const at = Math.floor((el.currentTime / el.duration) * full.length);
        let start = at;
        while (start > 0 && /\S/.test(full[start - 1])) start--;
        const len = full.slice(start).match(/^\S+/)?.[0].length ?? 0;
        boundary.current = start;
        setWord((w) => (w && w.unit === i && w.start === start ? w : { unit: i, start, length: len }));
      };
      el.onended = () => {
        if (token.current !== my || statusRef.current !== "playing") return;
        finishUnit(i, my);
      };
      el.onerror = () => {
        if (token.current !== my) return;
        setBuffering(false);
        if (statusRef.current === "playing") finishUnit(i, my);
      };
    };

    // Resuming the same clip: carry on from exactly where it paused.
    if (charOffset > 0 && el.dataset.key === key && el.src && el.currentTime > 0) {
      attach();
      void el.play().catch(() => {});
      return;
    }

    setBuffering(true);
    clipUrl(full)
      .then((url) => {
        if (token.current !== my) return;
        el.dataset.key = key;
        el.src = url;
        attach();
        const begin = () => {
          if (token.current !== my) return;
          if (charOffset > 0 && el.duration && isFinite(el.duration)) {
            el.currentTime = (charOffset / full.length) * el.duration;
          }
          setBuffering(false);
          void el.play().catch(() => {});
        };
        if (el.readyState >= 1) begin();
        else el.onloadedmetadata = begin;
        // Fetch the next sentences while this one plays, so there is no gap.
        for (let k = 1; k <= 2; k++) {
          const next = latest.current.units[i + k];
          if (next?.trim()) void clipUrl(next).catch(() => {});
        }
      })
      .catch((e: unknown) => {
        if (token.current !== my) return;
        setBuffering(false);
        token.current++;
        setStatusBoth("paused");
        latest.current.onError?.(e instanceof Error ? e.message : "The OpenAI voice failed.");
      });
  };

  const speakFrom = useCallback((i: number, charOffset = 0) => {
    clearGap();
    const my = ++token.current;
    const o = latest.current;
    if (i >= o.units.length) {
      silenceAll();
      setStatusBoth("idle");
      setWord(null);
      o.onFinished?.();
      return;
    }
    indexRef.current = i;
    boundary.current = charOffset;
    setIndex(i);
    setWord(null);
    setAside(null);
    asideAudio.current?.pause();
    setStatusBoth("playing");

    if (!o.units[i].slice(charOffset).trim()) {
      speakRef.current(i + 1);
      return;
    }
    if (o.engine === "openai") {
      window.speechSynthesis?.cancel();
      speakOpenAi(i, charOffset, my);
    } else {
      audio.current?.pause();
      speakDevice(i, charOffset, my);
    }
    // The helpers read everything from refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    speakRef.current = speakFrom;
  }, [speakFrom]);

  const play = useCallback(
    (i?: number) => {
      const target = i ?? indexRef.current;
      speakFrom(target, i === undefined && statusRef.current === "paused" ? boundary.current : 0);
    },
    [speakFrom],
  );

  const pause = useCallback(() => {
    if (statusRef.current !== "playing") return;
    token.current++;
    clearGap();
    window.speechSynthesis?.cancel();
    audio.current?.pause();
    setBuffering(false);
    setStatusBoth("paused");
  }, []);

  const resume = useCallback(() => {
    speakFrom(indexRef.current, boundary.current);
  }, [speakFrom]);

  const toggle = useCallback(() => {
    if (statusRef.current === "playing") pause();
    else if (statusRef.current === "paused") resume();
    else play();
  }, [pause, resume, play]);

  const stop = useCallback(() => {
    token.current++;
    silenceAll();
    boundary.current = 0;
    setWord(null);
    setAside(null);
    setBuffering(false);
    setStatusBoth("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Moves the reading position without speaking (keeps playing if already playing). */
  const seek = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(i, latest.current.units.length - 1));
      if (statusRef.current === "playing") {
        speakFrom(clamped);
      } else {
        indexRef.current = clamped;
        boundary.current = 0;
        setIndex(clamped);
        setWord(null);
        if (statusRef.current === "paused") setStatusBoth("idle");
      }
    },
    [speakFrom],
  );

  /** Speaks other text (an AI answer, a word, a teacher note). Pauses the book first. */
  const say = useCallback(
    (text: string, onDone?: () => void) => {
      if (statusRef.current === "playing") pause();
      const my = ++token.current;
      silenceAll();
      const o = latest.current;
      const clean = text.replace(/[#*_`>|]/g, " ").replace(/\s+\n/g, "\n");
      setAside(text);
      const done = () => {
        if (token.current !== my) return;
        setAside(null);
        onDone?.();
      };

      if (o.engine === "openai") {
        // Paragraph-sized clips (the API takes up to 4096 characters).
        const parts: string[] = [];
        for (const para of clean.split(/\n{2,}/)) {
          let rest = para.trim();
          while (rest.length > 3500) {
            const cut = rest.lastIndexOf(". ", 3500) + 1 || 3500;
            parts.push(rest.slice(0, cut));
            rest = rest.slice(cut).trim();
          }
          if (rest) parts.push(rest);
        }
        const el = (asideAudio.current ??= new Audio());
        const next = (k: number) => {
          if (token.current !== my) return;
          if (k >= parts.length) return done();
          setBuffering(true);
          clipUrl(parts[k])
            .then((url) => {
              if (token.current !== my) return;
              setBuffering(false);
              el.src = url;
              el.playbackRate = latest.current.rate;
              el.onended = () => next(k + 1);
              void el.play().catch(() => done());
            })
            .catch((e: unknown) => {
              setBuffering(false);
              if (token.current !== my) return;
              latest.current.onError?.(e instanceof Error ? e.message : "The OpenAI voice failed.");
              done();
            });
        };
        next(0);
        return;
      }

      const synth = window.speechSynthesis;
      const parts = clean
        .split(/\n+/)
        .flatMap((line) => splitUnits(line))
        .filter((p) => p.trim());
      const next = (k: number) => {
        if (token.current !== my) return;
        if (k >= parts.length) return done();
        const u = new SpeechSynthesisUtterance(parts[k]);
        if (o.voice) {
          u.voice = o.voice;
          u.lang = o.voice.lang;
        }
        u.rate = o.rate;
        u.pitch = o.pitch;
        u.onend = () => next(k + 1);
        u.onerror = () => done();
        synth.speak(u);
      };
      setTimeout(() => next(0), 60);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pause, clipUrl],
  );

  const stopAside = useCallback(() => {
    token.current++;
    window.speechSynthesis?.cancel();
    asideAudio.current?.pause();
    setBuffering(false);
    setAside(null);
  }, []);

  // A new chapter (new units): forget the word position.
  const unitsKey = units.length ? `${units.length}:${units[0]}` : "";
  const prevKey = useRef(unitsKey);
  useEffect(() => {
    if (prevKey.current === unitsKey) return;
    prevKey.current = unitsKey;
    boundary.current = 0;
  }, [unitsKey]);

  // Speed on the OpenAI voice changes instantly, no new audio needed.
  useEffect(() => {
    if (audio.current) audio.current.playbackRate = rate;
    if (asideAudio.current) asideAudio.current.playbackRate = rate;
  }, [rate]);

  // Voice, engine, style (or device speed/pitch) changed mid-sentence: carry on from the current word.
  const settingsKey =
    engine === "openai"
      ? `openai|${openai.voice}|${openai.model}|${style}`
      : `device|${voice?.voiceURI ?? ""}|${rate}|${pitch}|${style}`;
  const prevSettings = useRef(settingsKey);
  useEffect(() => {
    if (prevSettings.current === settingsKey) return;
    prevSettings.current = settingsKey;
    if (statusRef.current === "playing") {
      silenceAll();
      if (audio.current) audio.current.dataset.key = "";
      speakFrom(indexRef.current, boundary.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsKey, speakFrom]);

  // Stop talking when the page goes away.
  useEffect(
    () => () => {
      token.current++;
      silenceAll();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return { status, index, word, aside, buffering, play, pause, resume, toggle, stop, seek, say, stopAside, speakFrom };
}
