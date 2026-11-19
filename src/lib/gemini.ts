import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { ChatMessage } from "./chat-types";
import type { ModelId } from "./models";

export interface StreamReplyOptions {
  apiKey: string;
  model: ModelId;
  systemInstruction: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
}

/**
 * Calls Gemini with the system instruction kept separate from the conversation.
 *
 * - `config.systemInstruction` carries the persona (the system prompt).
 * - `contents` carries the conversation: earlier turns plus the new user prompt.
 *
 * Yields text chunks as they arrive. A client is created per request so a
 * visitor's key never outlives the request that brought it.
 */
export async function* streamReply({
  apiKey,
  model,
  systemInstruction,
  messages,
  signal,
}: StreamReplyOptions): AsyncGenerator<string> {
  const ai = new GoogleGenAI({ apiKey });

  const stream = await ai.models.generateContentStream({
    model,
    contents: messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    config: {
      systemInstruction,
      temperature: 0.9,
      maxOutputTokens: 1024,
      abortSignal: signal,
    },
  });

  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) yield text;
  }
}

/**
 * Turns an SDK error into a short message that is safe to show the visitor.
 * Never includes the raw error, which could contain request details.
 */
export function describeGeminiError(error: unknown): { status: number; message: string } {
  const status =
    typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
      ? error.status
      : 0;

  if (status === 400 || status === 401 || status === 403) {
    return { status: 401, message: "Gemini rejected the API key or request. Check your key and try again." };
  }
  if (status === 404) {
    return { status: 502, message: "That model is not available for this API key. Try the other model." };
  }
  if (status === 429) {
    return { status: 429, message: "Rate limit or quota reached on this key. Wait a moment and try again." };
  }
  return { status: 502, message: "Gemini could not complete the reply. Please try again." };
}
