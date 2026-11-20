import "server-only";
import OpenAI from "openai";
import type { CreateSession } from "./types";

/**
 * OpenAI and Groq share Chat Completions function calling: the assistant
 * message with `tool_calls` goes back, then one `tool` message per call.
 */
function createSession(baseURL?: string): CreateSession {
  return ({ apiKey, model, system, tools, turns }) => {
    const client = new OpenAI({ apiKey, baseURL, maxRetries: 1 });
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: system },
      ...turns.map((t) => ({ role: t.role, content: t.text })),
    ];
    const toolDefs: OpenAI.Chat.ChatCompletionTool[] = tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));

    return {
      async next(signal) {
        const res = await client.chat.completions.create(
          { model, messages, tools: toolDefs, max_completion_tokens: 8192 },
          { signal },
        );
        const choice = res.choices[0];
        const msg = choice?.message;
        const toolCalls = (msg?.tool_calls ?? []).filter(
          (c): c is OpenAI.Chat.ChatCompletionMessageFunctionToolCall => c.type === "function",
        );
        messages.push({
          role: "assistant",
          content: msg?.content ?? null,
          ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
        });

        const calls = toolCalls.map((c) => {
          let args: unknown;
          try {
            args = JSON.parse(c.function.arguments || "{}");
          } catch {
            args = { _invalid_json: c.function.arguments.slice(0, 200) };
          }
          return { id: c.id, name: c.function.name, args };
        });
        const stopNote =
          choice?.finish_reason === "length"
            ? "The model ran out of output tokens."
            : choice?.finish_reason === "content_filter"
              ? "The provider's content filter stopped the reply."
              : undefined;
        return { calls, text: msg?.content ?? "", stopNote };
      },

      addResults(results) {
        for (const { call, result } of results) {
          messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
        }
      },
    };
  };
}

export const openaiSession = createSession();
export const groqSession = createSession("https://api.groq.com/openai/v1");
