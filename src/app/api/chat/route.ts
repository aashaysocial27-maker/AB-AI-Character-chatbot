import { describeGeminiError, streamReply } from "@/lib/gemini";
import { isPlausibleKey, validateChatRequest } from "@/lib/validation";
import { KEY_HEADER } from "@/lib/chat-types";

// Never cache, never prerender: every reply depends on the request.
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 64 * 1024;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * POST /api/chat
 *
 * Body: { personaId, model, systemInstruction, messages }
 * Header (optional): x-gemini-key — the visitor's own key. Falls back to GEMINI_API_KEY.
 *
 * Streams the reply back as plain UTF-8 text (Markdown). The key is used only
 * for this request: it is not logged, stored, or included in any response.
 */
export async function POST(request: Request) {
  // Resolve the key: visitor header first, then local env.
  const headerKey = request.headers.get(KEY_HEADER)?.trim() ?? "";
  const apiKey = headerKey || process.env.GEMINI_API_KEY?.trim() || "";
  if (!apiKey) {
    return jsonError("Add a Gemini API key to start chatting.", 401);
  }
  if (!isPlausibleKey(apiKey)) {
    return jsonError("That does not look like a Gemini API key.", 400);
  }

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
  const { persona, model, messages } = result.value;

  const chunks = streamReply({
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
    const { status, message } = describeGeminiError(error);
    console.error(`[api/chat] Gemini request failed (status ${status})`);
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
        console.error("[api/chat] Gemini stream interrupted");
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
