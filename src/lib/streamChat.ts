import { KEY_HEADER, type ChatRequestBody } from "./chat-types";

/**
 * Sends the request to /api/chat and yields the reply text as it streams in.
 * Throws an Error with a readable message if the server refuses the request.
 */
export async function* streamChat(
  body: ChatRequestBody,
  apiKey: string,
  signal: AbortSignal,
): AsyncGenerator<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers[KEY_HEADER] = apiKey;

  const res = await fetch("/api/chat", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    let message = `Request failed (${res.status}).`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // Non-JSON error body; keep the generic message.
    }
    throw new Error(message);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) return;
    if (value) yield value;
  }
}
