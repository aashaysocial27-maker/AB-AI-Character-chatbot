import "server-only";
import { GoogleGenAI } from "@google/genai";
import { MAX_OUTPUT_TOKENS, type StreamReply } from "./types";

/**
 * Gemini keeps the system prompt out of the conversation:
 * `config.systemInstruction` holds the persona, `contents` holds the turns.
 */
export const streamGemini: StreamReply = async function* ({ apiKey, model, systemInstruction, messages, signal }) {
  const ai = new GoogleGenAI({ apiKey });

  const stream = await ai.models.generateContentStream({
    model,
    contents: messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    config: {
      systemInstruction,
      temperature: 0.9,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      abortSignal: signal,
    },
  });

  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) yield text;
  }
};
