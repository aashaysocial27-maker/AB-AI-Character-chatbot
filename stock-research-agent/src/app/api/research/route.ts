import { runResearch } from "@/lib/agent";
import { describeProviderError } from "@/lib/llm";
import { getProvider, isListedModel } from "@/lib/providers";
import type { AgentEvent, ChatTurn } from "@/lib/types";

// Never cache, never prerender: every answer depends on the request.
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_BODY_BYTES = 48 * 1024;
const MAX_TURNS = 20;
const MAX_TEXT = 1000;
const MAX_TOTAL = 16000;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function readTurns(value: unknown): ChatTurn[] | string {
  if (!Array.isArray(value) || value.length === 0) return "Ask a question first.";
  if (value.length > MAX_TURNS) return "This chat is too long. Start a new chat.";
  const turns: ChatTurn[] = [];
  let total = 0;
  for (const raw of value) {
    const m = raw as Record<string, unknown> | null;
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.text !== "string") return "Malformed message.";
    const text = m.text.trim();
    if (!text) continue;
    if (text.length > (m.role === "user" ? MAX_TEXT : MAX_TEXT * 3)) return `Messages must be under ${MAX_TEXT} characters.`;
    total += text.length;
    turns.push({ role: m.role, text });
  }
  if (total > MAX_TOTAL) return "This chat is too long. Start a new chat.";
  if (turns.at(-1)?.role !== "user") return "The last message must be a question.";
  return turns;
}

/**
 * POST /api/research
 * Body: { provider, model, messages: [{ role: "user" | "assistant", text }] }
 * Header: the provider's key header (x-gemini-key, x-anthropic-key, x-openai-key, x-groq-key).
 *
 * Streams newline-delimited JSON events (see AgentEvent). The key is used only
 * for this request: never logged, stored or returned.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return jsonError("Request is too large.", 413);
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  const provider = getProvider(body?.provider);
  if (!provider) return jsonError("Unknown provider.", 400);
  if (!isListedModel(provider, body.model)) return jsonError("Unknown model.", 400);
  const turns = readTurns(body.messages);
  if (typeof turns === "string") return jsonError(turns, 400);

  const apiKey = request.headers.get(provider.keyHeader)?.trim() ?? "";
  if (!apiKey) return jsonError(`Add your ${provider.label} API key to start.`, 401);
  if (apiKey.length < 10 || apiKey.length > 300 || !/^[\x21-\x7e]+$/.test(apiKey)) {
    return jsonError(`That does not look like a ${provider.label} API key.`, 400);
  }

  const model = body.model;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AgentEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        for await (const event of runResearch({ provider, apiKey, model, turns, signal: request.signal })) {
          send(event);
        }
      } catch (error) {
        if (!request.signal.aborted) {
          console.error(`[api/research] ${provider.label} request failed`);
          send({ type: "error", message: describeProviderError(error, provider.label) });
        }
      }
      try {
        controller.close();
      } catch {
        // Client already went away.
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
