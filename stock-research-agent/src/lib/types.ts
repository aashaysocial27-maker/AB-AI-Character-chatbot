/** Types shared by the server and the browser. */

export type ToolName = "search_stocks" | "get_quote" | "get_history";

export interface ToolResult {
  ok: boolean;
  /** Present when ok. Shape depends on the tool (see lib/tools.ts). */
  data?: unknown;
  /** Present when not ok. Plain message, never made-up numbers. */
  error?: string;
  source: string;
  fetchedAt: string;
  link?: string;
}

export interface QuoteData {
  symbol: string;
  name: string | null;
  exchange: string | null;
  currency: string | null;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  previousClose: number | null;
  volume: number | null;
  marketCap: number | null;
  marketTime: string | null;
  marketState: string | null;
}

export interface SearchMatch {
  symbol: string;
  name: string | null;
  exchange: string | null;
  type: string | null;
}

export interface SearchData {
  query: string;
  matches: SearchMatch[];
}

export interface HistoryBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

export interface HistoryData {
  symbol: string;
  currency: string | null;
  interval: "1d";
  bars: HistoryBar[];
}

/** One line of the newline-delimited JSON stream from POST /api/research. */
export type AgentEvent =
  | { type: "status"; text: string }
  | { type: "tool_start"; id: string; name: string; args: unknown }
  | { type: "tool_end"; id: string; ms: number; result: ToolResult }
  | { type: "answer"; text: string }
  | { type: "error"; message: string }
  | { type: "done"; rounds: number; toolCalls: number };

/** Earlier turns go back to the server as plain text. */
export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}
