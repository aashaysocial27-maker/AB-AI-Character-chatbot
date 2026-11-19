/** Shapes shared by the browser and the /api/chat route. */

export type ChatRole = "user" | "model";

export interface ChatMessage {
  role: ChatRole;
  text: string;
}

/** Exactly what the browser POSTs to /api/chat. */
export interface ChatRequestBody {
  provider: string;
  model: string;
  personaId: string;
  systemInstruction: string;
  /** Full conversation so far; the last entry is the new user prompt. */
  messages: ChatMessage[];
}
