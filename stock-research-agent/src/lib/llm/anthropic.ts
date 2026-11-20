import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { CreateSession } from "./types";

/** Models that accept server-side refusal fallbacks (Haiku does not). */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-sonnet-5-5"]);

/**
 * Claude tool use. The full `response.content` (thinking blocks included) goes
 * back as the assistant turn, and every tool_use gets a tool_result in one
 * user message.
 */
export const anthropicSession: CreateSession = ({ apiKey, model, system, tools, turns }) => {
  const client = new Anthropic({ apiKey, maxRetries: 1 });
  const messages: Anthropic.Beta.BetaMessageParam[] = turns.map((t) => ({ role: t.role, content: t.text }));
  const toolDefs: Anthropic.Beta.BetaTool[] = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Beta.BetaTool.InputSchema,
  }));
  const useFallbacks = FALLBACK_MODELS.has(model);

  return {
    async next(signal) {
      const res = await client.beta.messages.create(
        {
          model,
          max_tokens: 16000,
          system,
          tools: toolDefs,
          messages,
          // Short, tool-driven answers: low effort keeps each round fast.
          output_config: { effort: "low" },
          // If a safety classifier declines, retry on a fallback model in the same call.
          ...(useFallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
        },
        { signal },
      );
      messages.push({ role: "assistant", content: res.content as Anthropic.Beta.BetaContentBlockParam[] });

      const calls = res.content
        .filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use")
        .map((b) => ({ id: b.id, name: b.name, args: b.input }));
      const text = res.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

      let stopNote: string | undefined;
      if (res.stop_reason === "refusal") stopNote = "Claude declined to continue this request.";
      else if (res.stop_reason === "max_tokens") stopNote = "Claude ran out of output tokens.";
      return { calls: res.stop_reason === "refusal" ? [] : calls, text, stopNote };
    },

    addResults(results) {
      messages.push({
        role: "user",
        content: results.map(({ call, result }) => ({
          type: "tool_result" as const,
          tool_use_id: call.id,
          content: JSON.stringify(result),
          ...(result.ok ? {} : { is_error: true }),
        })),
      });
    },
  };
};
