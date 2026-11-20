import type { AgentEvent, ToolResult } from "./types";

export interface ToolCallView {
  id: string;
  name: string;
  args: unknown;
  ms?: number;
  result?: ToolResult;
}

export interface UserMessage {
  id: string;
  role: "user";
  text: string;
}

export interface AssistantMessage {
  id: string;
  role: "assistant";
  /** Provider and model that answered, e.g. "Gemini 3.8 Flash". */
  label: string;
  steps: string[];
  calls: ToolCallView[];
  answer?: string;
  error?: string;
  running: boolean;
  stopped?: boolean;
}

export type ChatMessage = UserMessage | AssistantMessage;

/** Folds one streamed event into the assistant message being built. */
export function applyEvent(m: AssistantMessage, e: AgentEvent): AssistantMessage {
  switch (e.type) {
    case "status":
      return { ...m, steps: [...m.steps, e.text] };
    case "tool_start":
      return { ...m, calls: [...m.calls, { id: e.id, name: e.name, args: e.args }] };
    case "tool_end":
      return { ...m, calls: m.calls.map((c) => (c.id === e.id ? { ...c, ms: e.ms, result: e.result } : c)) };
    case "answer":
      return { ...m, answer: e.text };
    case "error":
      return { ...m, error: e.message, running: false };
    case "done":
      return { ...m, running: false };
  }
}
