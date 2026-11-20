import type { ChatTurn, ToolResult } from "../types";
import type { TOOL_DEFS } from "../tools";

export interface ToolCall {
  id: string;
  name: string;
  args: unknown;
}

export interface Turn {
  /** Tools the model asked for this round (empty when it wrote the answer). */
  calls: ToolCall[];
  text: string;
  /** Set when the model stopped for a reason other than finishing normally. */
  stopNote?: string;
}

/**
 * One conversation with one provider. The adapter keeps the provider's own
 * message format (including Gemini thought signatures and Claude thinking
 * blocks) so each round sends back exactly what the model produced.
 */
export interface AgentSession {
  next(signal: AbortSignal): Promise<Turn>;
  addResults(results: { call: ToolCall; result: ToolResult }[]): void;
}

export interface SessionOptions {
  apiKey: string;
  model: string;
  system: string;
  tools: typeof TOOL_DEFS;
  /** Earlier turns as plain text, then the new question last. */
  turns: ChatTurn[];
}

export type CreateSession = (options: SessionOptions) => AgentSession;
