import "server-only";
import type { ProviderId } from "../providers";
import { streamAnthropic } from "./anthropic";
import { streamGemini } from "./gemini";
import { streamGroq, streamOpenAI } from "./openai-compatible";
import type { StreamReply } from "./types";

export const STREAMERS: Record<ProviderId, StreamReply> = {
  gemini: streamGemini,
  anthropic: streamAnthropic,
  openai: streamOpenAI,
  groq: streamGroq,
};

/**
 * Turns any provider SDK error into a short message that is safe to show.
 * All three SDKs expose the HTTP status as `error.status`. The raw error is
 * never returned, since it could include request details.
 */
export function describeProviderError(error: unknown, providerLabel: string): { status: number; message: string } {
  const status =
    typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
      ? error.status
      : 0;

  if (status === 401 || status === 403) {
    return { status: 401, message: `${providerLabel} rejected the API key. Check the key and try again.` };
  }
  if (status === 400) {
    return {
      status: 400,
      message: `${providerLabel} rejected the request. Check the API key and, if you typed a custom model, its ID.`,
    };
  }
  if (status === 404) {
    return { status: 502, message: `That model is not available on ${providerLabel} for this key. Try another model.` };
  }
  if (status === 429) {
    return { status: 429, message: `Rate limit or quota reached on this ${providerLabel} key. Wait a moment and try again.` };
  }
  if (status === 402) {
    return { status: 402, message: `${providerLabel} says this account has no credit left.` };
  }
  if (status === 0) {
    return { status: 502, message: `Could not reach ${providerLabel}. Check the connection and try again.` };
  }
  return { status: 502, message: `${providerLabel} could not complete the reply. Please try again.` };
}
