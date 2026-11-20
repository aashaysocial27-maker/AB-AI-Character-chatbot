"use client";

import type { ChatMessage } from "../chat-types";
import { getProvider } from "../providers";

export interface AskBody {
  provider: string;
  model: string;
  task: "ask" | "define";
  bookTitle: string;
  chapterTitle: string;
  context: string;
  passage: string;
  messages: ChatMessage[];
}

/** Streams an answer from /api/ask. The key travels only in the provider's header. */
export async function* streamAsk(body: AskBody, apiKey: string, signal: AbortSignal): AsyncGenerator<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const provider = getProvider(body.provider);
  if (apiKey && provider) headers[provider.keyHeader] = apiKey;

  const res = await fetch("/api/ask", { method: "POST", headers, body: JSON.stringify(body), signal });
  if (!res.ok || !res.body) {
    let message = `Request failed (${res.status}).`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // keep generic message
    }
    throw new Error(message);
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) return;
    if (value) yield value;
  }
}

/** Looks a word up in the free dictionaryapi.dev service. Returns null if not found. */
export async function lookupWord(word: string): Promise<{ definition: string; phonetic?: string } | null> {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`);
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{
      phonetic?: string;
      phonetics?: Array<{ text?: string }>;
      meanings?: Array<{ partOfSpeech?: string; definitions?: Array<{ definition?: string }> }>;
    }>;
    const entry = data[0];
    const meanings = (entry?.meanings ?? [])
      .slice(0, 2)
      .map((m) => {
        const d = m.definitions?.[0]?.definition;
        return d ? `(${m.partOfSpeech ?? "—"}) ${d}` : "";
      })
      .filter(Boolean);
    if (meanings.length === 0) return null;
    return {
      definition: meanings.join("\n"),
      phonetic: entry.phonetic ?? entry.phonetics?.find((p) => p.text)?.text,
    };
  } catch {
    return null;
  }
}

/** Plain text of a chapter, trimmed to fit a request. Centred on the reading position if too long. */
export function chapterContext(paragraphs: string[], focusParagraph: number, maxChars = 110_000): string {
  const full = paragraphs.join("\n\n");
  if (full.length <= maxChars) return full;
  let lo = focusParagraph;
  let hi = focusParagraph;
  let size = paragraphs[focusParagraph]?.length ?? 0;
  while (size < maxChars && (lo > 0 || hi < paragraphs.length - 1)) {
    if (hi < paragraphs.length - 1) size += paragraphs[++hi].length + 2;
    if (lo > 0 && size < maxChars) size += paragraphs[--lo].length + 2;
  }
  return `${lo > 0 ? "[…]\n\n" : ""}${paragraphs.slice(lo, hi + 1).join("\n\n")}${hi < paragraphs.length - 1 ? "\n\n[…]" : ""}`;
}
