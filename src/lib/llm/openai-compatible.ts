import "server-only";
import OpenAI from "openai";
import { MAX_OUTPUT_TOKENS, type StreamReply } from "./types";

/**
 * OpenAI and Groq share the Chat Completions format: the persona is simply the
 * first message, with role "system", followed by the user/assistant turns.
 */
function createStreamer(baseURL?: string): StreamReply {
  return async function* ({ apiKey, model, systemInstruction, messages, signal }) {
    const client = new OpenAI({ apiKey, baseURL, maxRetries: 1 });

    const stream = await client.chat.completions.create(
      {
        model,
        stream: true,
        max_completion_tokens: MAX_OUTPUT_TOKENS,
        messages: [
          { role: "system", content: systemInstruction },
          ...messages.map((m) => ({
            role: m.role === "model" ? ("assistant" as const) : ("user" as const),
            content: m.text,
          })),
        ],
      },
      { signal },
    );

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) yield text;
    }
  };
}

export const streamOpenAI = createStreamer();
export const streamGroq = createStreamer("https://api.groq.com/openai/v1");
