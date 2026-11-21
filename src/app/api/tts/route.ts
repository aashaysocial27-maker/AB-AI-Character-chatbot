import OpenAI from "openai";
import { describeProviderError } from "@/lib/llm";
import { isValidModel } from "@/lib/providers";
import { isPlausibleKey } from "@/lib/validation";
import { OPENAI_VOICES, STYLE_INSTRUCTIONS, type ReadingStyle } from "@/lib/reader/voice-options";

export const dynamic = "force-dynamic";

const MAX_TEXT = 4000;
const VOICE_IDS = new Set(OPENAI_VOICES.map((v) => v.id));

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * POST /api/tts — turns a sentence or paragraph into speech with OpenAI.
 *
 * Body: { text, voice, model, style: "plain" | "storyteller" | "teacher" }
 * Header: x-openai-key (the reader's key), or OPENAI_API_KEY on the server.
 * Returns audio/mpeg. The key is used for this request only and never logged.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (typeof parsed !== "object" || parsed === null) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return jsonError("Request body must be a JSON object.", 400);
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return jsonError("Nothing to read.", 400);
  if (text.length > MAX_TEXT) return jsonError(`Text must be under ${MAX_TEXT} characters.`, 400);
  const voice = typeof body.voice === "string" && VOICE_IDS.has(body.voice) ? body.voice : "coral";
  const model = isValidModel(body.model) ? body.model : "gpt-4o-mini-tts";
  const style = (["plain", "storyteller", "teacher"].includes(body.style as string) ? body.style : "plain") as ReadingStyle;

  const headerKey = request.headers.get("x-openai-key")?.trim() ?? "";
  const apiKey = headerKey || process.env.OPENAI_API_KEY?.trim() || "";
  if (!apiKey) return jsonError("Add your OpenAI API key in the voice settings to use the OpenAI voice.", 401);
  if (!isPlausibleKey(apiKey)) return jsonError("That does not look like an OpenAI API key.", 400);

  try {
    const client = new OpenAI({ apiKey, maxRetries: 1 });
    const speech = await client.audio.speech.create(
      {
        model,
        voice,
        input: text,
        response_format: "mp3",
        // Older tts-1 models ignore style instructions.
        ...(model.startsWith("tts-1") ? {} : { instructions: STYLE_INSTRUCTIONS[style] }),
      },
      { signal: request.signal },
    );
    const audio = await speech.arrayBuffer();
    return new Response(audio, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    const { status, message } = describeProviderError(error, "OpenAI");
    console.error(`[api/tts] OpenAI request failed (status ${status})`);
    return jsonError(message, status);
  }
}
