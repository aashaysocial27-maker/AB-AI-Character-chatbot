/** Shapes shared by the browser and the /api/chat route. */

export type ChatRole = "user" | "model";

export interface ChatMessage {
  role: ChatRole;
  text: string;
}

/** Exactly what the browser POSTs to /api/chat. */
export interface ChatRequestBody {
  personaId: string;
  model: string;
  systemInstruction: string;
  /** Full conversation so far; the last entry is the new user prompt. */
  messages: ChatMessage[];
}

/** Header that carries a visitor's own Gemini key. */
export const KEY_HEADER = "x-gemini-key";
