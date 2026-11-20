import "server-only";
import type { ProviderId } from "../providers";
import { anthropicSession } from "./anthropic";
import { geminiSession } from "./gemini";
import { groqSession, openaiSession } from "./openai-compatible";
import type { CreateSession } from "./types";

export const SESSIONS: Record<ProviderId, CreateSession> = {
  gemini: geminiSession,
  anthropic: anthropicSession,
  openai: openaiSession,
  groq: groqSession,
};

/**
 * Turns any provider SDK error into a short message that is safe to show.
 * All three SDKs expose the HTTP status as `error.status`. The raw error is
 * never returned, since it could include request details.
 */
export function describeProviderError(error: unknown, label: string): string {
  const status =
    typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
      ? error.status
      : 0;
  if (status === 401 || status === 403) return `${label} rejected the API key. Check the key and try again.`;
  if (status === 400) return `${label} rejected the request. Check the API key and the selected model.`;
  if (status === 404) return `That model is not available on ${label} for this key. Try another model.`;
  if (status === 429) return `Rate limit or quota reached on this ${label} key. Wait a moment and try again.`;
  if (status === 402) return `${label} says this account has no credit left.`;
  if (status === 0) return `Could not reach ${label}. Check the connection and try again.`;
  return `${label} could not complete the reply. Please try again.`;
}
