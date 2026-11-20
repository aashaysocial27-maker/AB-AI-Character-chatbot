"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { splitUnits } from "./layout";

/**
 * Read-aloud engine on top of the browser's Speech Synthesis API.
 *
 * Text is spoken one sentence at a time. That keeps long chapters from being
 * cut off (Chrome stops very long utterances), lets the page highlight the
 * sentence being read, and makes pause/resume exact: pausing remembers the
 * last word reached and resuming continues from that word, on every browser,
 * including mobile ones where speechSynthesis.pause() does not work.
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

interface Options {
  units: string[];
  voice: SpeechSynthesisVoice | null;
  rate: number;
  pitch: number;
  /** Called when the last unit finishes (e.g. to move to the next chapter). */
  onFinished?: () => void;
}

export function useSpeech({ units, voice, rate, pitch, onFinished }: Options) {
  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [index, setIndex] = useState(0);
  const [word, setWord] = useState<WordMark | null>(null);
  /** Short text being spoken outside the book (an answer, a word). */
  const [aside, setAside] = useState<string | null>(null);

  const token = useRef(0);
  const indexRef = useRef(0);
  const boundary = useRef(0);
  const statusRef = useRef<SpeechStatus>("idle");
  const latest = useRef({ units, voice, rate, pitch, onFinished });
  useEffect(() => {
    latest.current = { units, voice, rate, pitch, onFinished };
  });

  const setStatusBoth = (s: SpeechStatus) => {
    statusRef.current = s;
    setStatus(s);
  };

  const makeUtterance = (text: string) => {
    const { voice: v, rate: r, pitch: p } = latest.current;
    const u = new SpeechSynthesisUtterance(text);
    if (v) {
      u.voice = v;
      u.lang = v.lang;
    }
    u.rate = r;
    u.pitch = p;
    return u;
  };

  const speakRef = useRef<(i: number, charOffset?: number) => void>(() => {});
  const speakFrom = useCallback((i: number, charOffset = 0) => {
    const synth = window.speechSynthesis;
    const my = ++token.current;
    const { units: list } = latest.current;
    if (i >= list.length) {
      setStatusBoth("idle");
      setWord(null);
      latest.current.onFinished?.();
      return;
    }
    indexRef.current = i;
    boundary.current = charOffset;
    setIndex(i);
    setWord(null);
    setAside(null);
    setStatusBoth("playing");

    const text = list[i].slice(charOffset);
    if (!text.trim()) {
      speakRef.current(i + 1);
      return;
    }
    const u = makeUtterance(text);
    u.onboundary = (e) => {
      if (token.current !== my || e.name !== "word") return;
      const start = charOffset + e.charIndex;
      boundary.current = start;
      const len = e.charLength || (list[i].slice(start).match(/^\S+/)?.[0].length ?? 0);
      setWord({ unit: i, start, length: len });
    };
    u.onend = () => {
      if (token.current !== my || statusRef.current !== "playing") return;
      speakRef.current(i + 1);
    };
    u.onerror = (e) => {
      if (token.current !== my || e.error === "interrupted" || e.error === "canceled") return;
      if (statusRef.current === "playing") speakRef.current(i + 1);
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
    window.speechSynthesis.cancel();
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
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    boundary.current = 0;
    setWord(null);
    setAside(null);
    setStatusBoth("idle");
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

  /** Speaks some other text (an AI answer, a word) and pauses the book first. */
  const say = useCallback(
    (text: string) => {
      if (statusRef.current === "playing") pause();
      const my = ++token.current;
      const synth = window.speechSynthesis;
      synth.cancel();
      const parts = text
        .replace(/[#*_`>|]/g, " ")
        .split(/\n+/)
        .flatMap((line) => splitUnits(line))
        .filter((p) => p.trim());
      setAside(text);
      const next = (k: number) => {
        if (token.current !== my || k >= parts.length) {
          if (token.current === my) setAside(null);
          return;
        }
        const u = makeUtterance(parts[k]);
        u.onend = () => next(k + 1);
        u.onerror = () => token.current === my && setAside(null);
        synth.speak(u);
      };
      setTimeout(() => next(0), 60);
    },
    [pause],
  );

  const stopAside = useCallback(() => {
    token.current++;
    window.speechSynthesis.cancel();
    setAside(null);
  }, []);

  // A new chapter (new units): stop and start again at the top, unless told otherwise.
  const unitsKey = units.length ? `${units.length}:${units[0]}` : "";
  const prevKey = useRef(unitsKey);
  useEffect(() => {
    if (prevKey.current === unitsKey) return;
    prevKey.current = unitsKey;
    boundary.current = 0;
  }, [unitsKey]);

  // Voice or speed changed mid-sentence: carry on from the current word with the new settings.
  const settingsKey = `${voice?.voiceURI ?? ""}|${rate}|${pitch}`;
  const prevSettings = useRef(settingsKey);
  useEffect(() => {
    if (prevSettings.current === settingsKey) return;
    prevSettings.current = settingsKey;
    if (statusRef.current === "playing") speakFrom(indexRef.current, boundary.current);
  }, [settingsKey, speakFrom]);

  // Stop talking when the page goes away.
  useEffect(
    () => () => {
      token.current++;
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    },
    [],
  );

  return { status, index, word, aside, play, pause, resume, toggle, stop, seek, say, stopAside, speakFrom };
}
