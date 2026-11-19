import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { StreamReply } from "./types";

/** Models that accept server-side refusal fallbacks (Haiku does not). */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-sonnet-5-5"]);

/**
 * Claude takes the persona in the top-level `system` field and the
 * conversation in `messages` (with "assistant" instead of Gemini's "model").
 */
export const streamAnthropic: StreamReply = async function* ({ apiKey, model, systemInstruction, messages, signal }) {
  const client = new Anthropic({ apiKey, maxRetries: 1 });

  const useFallbacks = FALLBACK_MODELS.has(model);
  const stream = client.beta.messages.stream(
    {
      model,
      // Thinking counts toward this cap, so leave plenty of room.
      max_tokens: 16000,
      system: systemInstruction,
      messages: messages.map((m) => ({
        role: m.role === "model" ? ("assistant" as const) : ("user" as const),
        content: m.text,
      })),
      // Short chat answers: low effort keeps replies fast.
      output_config: { effort: "low" },
      // If a safety classifier declines, retry on a fallback model inside the same call.
      ...(useFallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    },
    { signal },
  );

  let refused = false;
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    } else if (event.type === "message_delta" && event.delta.stop_reason === "refusal") {
      refused = true;
    }
  }
  if (refused) yield "\n\n_The model declined to continue this request._";
};
