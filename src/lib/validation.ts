import { getPersona, type Persona } from "./personas";
import { getProvider, isValidModel, type Provider } from "./providers";
import { LIMITS } from "./limits";
import type { ChatMessage } from "./chat-types";

export interface ValidChatRequest {
  provider: Provider;
  model: string;
  persona: Persona;
  messages: ChatMessage[];
}

export type ValidationResult =
  | { ok: true; value: ValidChatRequest }
  | { ok: false; error: string };

function fail(error: string): ValidationResult {
  return { ok: false, error };
}

/**
 * Checks the untrusted JSON body sent by the browser.
 *
 * The system instruction must match a known persona exactly, so the route
 * can't be used as a general-purpose proxy for arbitrary prompts.
 */
export function validateChatRequest(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null) return fail("Request body must be a JSON object.");
  const b = body as Record<string, unknown>;

  const persona = typeof b.personaId === "string" ? getPersona(b.personaId) : undefined;
  if (!persona) return fail("Unknown character.");

  if (b.systemInstruction !== persona.systemInstruction) {
    return fail("System instruction does not match the selected character.");
  }

  const provider = getProvider(b.provider);
  if (!provider) return fail("Unknown provider.");
  if (!isValidModel(b.model)) return fail("That does not look like a valid model ID.");

  if (!Array.isArray(b.messages) || b.messages.length === 0) {
    return fail("Conversation is empty.");
  }
  if (b.messages.length > LIMITS.maxMessages) {
    return fail(`Conversation is too long (max ${LIMITS.maxMessages} messages). Start a new chat.`);
  }

  const messages: ChatMessage[] = [];
  let total = 0;
  for (let i = 0; i < b.messages.length; i++) {
    const m = b.messages[i] as Record<string, unknown> | null;
    if (typeof m !== "object" || m === null) return fail("Malformed message.");
    const expectedRole = i % 2 === 0 ? "user" : "model";
    if (m.role !== expectedRole) return fail("Messages must alternate user, model, user…");
    if (typeof m.text !== "string") return fail("Message text must be a string.");
    const text = m.text.trim();
    if (!text) return fail("Messages cannot be empty.");
    if (text.length > LIMITS.maxMessageChars) {
      return fail(`Each message must be at most ${LIMITS.maxMessageChars} characters.`);
    }
    total += text.length;
    messages.push({ role: expectedRole, text });
  }
  if (total > LIMITS.maxTotalChars) return fail("Conversation is too long. Start a new chat.");
  if (messages[messages.length - 1].role !== "user") return fail("The last message must be from the user.");

  return { ok: true, value: { provider, model: b.model, persona, messages } };
}

/** Light sanity check on a key from the header. Never echoes the key back. */
export function isPlausibleKey(key: string): boolean {
  return key.length >= 10 && key.length <= LIMITS.maxKeyChars && /^[\x21-\x7e]+$/.test(key);
}
