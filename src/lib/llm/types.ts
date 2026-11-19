import type { ChatMessage } from "../chat-types";

export interface StreamReplyOptions {
  apiKey: string;
  model: string;
  systemInstruction: string;
  /** Earlier turns plus the new user prompt (last). */
  messages: ChatMessage[];
  signal?: AbortSignal;
}

/** Each provider adapter yields reply text as it streams in. */
export type StreamReply = (options: StreamReplyOptions) => AsyncGenerator<string>;

/** Length cap for replies; personas ask for under 160 words, this leaves room for reasoning models. */
export const MAX_OUTPUT_TOKENS = 4096;
