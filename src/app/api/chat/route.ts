import { STREAMERS, describeProviderError } from "@/lib/llm";
import { isPlausibleKey, validateChatRequest } from "@/lib/validation";

// Never cache, never prerender: every reply depends on the request.
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 64 * 1024;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * POST /api/chat
 *
 * Body: { provider, model, personaId, systemInstruction, messages }
 * Header (optional): the provider's key header (x-gemini-key, x-anthropic-key,
 * x-openai-key or x-groq-key). Falls back to the provider's variable in .env.local.
 *
 * Streams the reply back as plain UTF-8 text (Markdown). The key is used only
 * for this request: it is not logged, stored, or included in any response.
 */
export async function POST(request: Request) {
  // Parse and validate the body.
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return jsonError("Request is too large.", 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }
  const result = validateChatRequest(body);
  if (!result.ok) return jsonError(result.error, 400);
  const { provider, model, persona, messages } = result.value;

  // Resolve the key: visitor header first, then the provider's variable in .env.local.
  const headerKey = request.headers.get(provider.keyHeader)?.trim() ?? "";
  const apiKey = headerKey || process.env[provider.envVar]?.trim() || "";
  if (!apiKey) {
    return jsonError(`Add a ${provider.label} API key to start chatting.`, 401);
  }
  if (!isPlausibleKey(apiKey)) {
    return jsonError(`That does not look like a ${provider.label} API key.`, 400);
  }

  const chunks = STREAMERS[provider.id]({
    apiKey,
    model,
    systemInstruction: persona.systemInstruction,
    messages,
    signal: request.signal,
  });

  // Wait for the first chunk so auth/model errors become a proper HTTP status
  // instead of a half-open stream.
  let first: IteratorResult<string>;
  try {
    first = await chunks.next();
  } catch (error) {
    const { status, message } = describeProviderError(error, provider.label);
    console.error(`[api/chat] ${provider.label} request failed (status ${status})`);
    return jsonError(message, status);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!first.done) controller.enqueue(encoder.encode(first.value));
        for await (const text of chunks) controller.enqueue(encoder.encode(text));
        controller.close();
      } catch {
        if (request.signal.aborted) return controller.close();
        console.error(`[api/chat] ${provider.label} stream interrupted`);
        controller.error(new Error("stream interrupted"));
      }
    },
    async cancel() {
      await chunks.return(undefined);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
