import "server-only";
import YahooFinance from "yahoo-finance2";
import type { HistoryBar, HistoryData, QuoteData, SearchData, SearchMatch, ToolName, ToolResult } from "./types";

const yahoo = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const SOURCE = "Yahoo Finance (unofficial, via yahoo-finance2)";
const SYMBOL = /^[A-Z0-9^][A-Z0-9.\-=^]{0,19}$/;
const QUERY = /^[\p{L}\p{N} .,&'\-()]{1,60}$/u;

/** Tool definitions in plain JSON Schema; each provider adapter wraps them in its own format. */
export const TOOL_DEFS: { name: ToolName; description: string; parameters: Record<string, unknown> }[] = [
  {
    name: "search_stocks",
    description:
      "Find ticker symbols for a company name or partial ticker. Returns up to 6 matches with exchange and type. Use before get_quote or get_history when the ticker is not certain (e.g. Indian stocks use .NS for NSE or .BO for BSE).",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "Company name or ticker, e.g. 'Infosys'." } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "get_quote",
    description:
      "Latest quote for one ticker: price, change, change percent, currency, market time, market state, previous close, volume and market cap. Quotes may be delayed.",
    parameters: {
      type: "object",
      properties: { symbol: { type: "string", description: "Yahoo ticker, e.g. 'AAPL' or 'TCS.NS'." } },
      required: ["symbol"],
      additionalProperties: false,
    },
  },
  {
    name: "get_history",
    description: "One month of daily bars for one ticker: date, open, high, low, close and volume.",
    parameters: {
      type: "object",
      properties: { symbol: { type: "string", description: "Yahoo ticker, e.g. 'MSFT'." } },
      required: ["symbol"],
      additionalProperties: false,
    },
  },
];

export function isToolName(name: string): name is ToolName {
  return TOOL_DEFS.some((t) => t.name === name);
}

type Checked = { ok: true; value: string } | { ok: false; error: string };

/** Checks the model's arguments before anything reaches Yahoo. */
function checkArgs(name: ToolName, args: unknown): Checked {
  const a = typeof args === "object" && args !== null ? (args as Record<string, unknown>) : {};
  const extra = Object.keys(a).filter((k) => k !== (name === "search_stocks" ? "query" : "symbol"));
  if (extra.length) return { ok: false, error: `Unexpected argument: ${extra.join(", ")}.` };

  if (name === "search_stocks") {
    const q = typeof a.query === "string" ? a.query.trim() : "";
    if (!QUERY.test(q)) return { ok: false, error: "query must be 1-60 letters, digits or spaces." };
    return { ok: true, value: q };
  }
  const s = typeof a.symbol === "string" ? a.symbol.trim().toUpperCase() : "";
  if (!SYMBOL.test(s)) return { ok: false, error: "symbol must look like a ticker, e.g. AAPL or TCS.NS." };
  return { ok: true, value: s };
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const round = (v: number) => Math.round(v * 10000) / 10000;
const iso = (v: unknown) => (v instanceof Date && !Number.isNaN(v.getTime()) ? v.toISOString() : null);

async function searchStocks(query: string): Promise<SearchData> {
  const res = await yahoo.search(query, { quotesCount: 6, newsCount: 0 });
  const matches: SearchMatch[] = [];
  for (const q of res.quotes as Record<string, unknown>[]) {
    const symbol = str(q.symbol);
    if (!symbol || q.isYahooFinance === false) continue;
    matches.push({
      symbol,
      name: str(q.longname) ?? str(q.shortname),
      exchange: str(q.exchDisp) ?? str(q.exchange),
      type: str(q.typeDisp) ?? str(q.quoteType),
    });
  }
  return { query, matches: matches.slice(0, 6) };
}

async function getQuote(symbol: string): Promise<QuoteData> {
  const q = (await yahoo.quote(symbol)) as Record<string, unknown> | undefined;
  if (!q || num(q.regularMarketPrice) === null) throw new Error(`No quote found for ${symbol}.`);
  return {
    symbol: str(q.symbol) ?? symbol,
    name: str(q.longName) ?? str(q.shortName),
    exchange: str(q.fullExchangeName) ?? str(q.exchange),
    currency: str(q.currency),
    price: num(q.regularMarketPrice),
    change: num(q.regularMarketChange),
    changePercent: num(q.regularMarketChangePercent),
    previousClose: num(q.regularMarketPreviousClose),
    volume: num(q.regularMarketVolume),
    marketCap: num(q.marketCap),
    marketTime: iso(q.regularMarketTime),
    marketState: str(q.marketState),
  };
}

async function getHistory(symbol: string): Promise<HistoryData> {
  const period1 = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
  const res = await yahoo.chart(symbol, { period1, interval: "1d" });
  const bars: HistoryBar[] = [];
  for (const b of res.quotes) {
    const [open, high, low, close] = [num(b.open), num(b.high), num(b.low), num(b.close)];
    if (open === null || high === null || low === null || close === null) continue;
    bars.push({
      date: b.date.toISOString().slice(0, 10),
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(close),
      volume: num(b.volume),
    });
  }
  if (!bars.length) throw new Error(`No daily prices found for ${symbol} in the last month.`);
  return { symbol: str(res.meta.symbol) ?? symbol, currency: str(res.meta.currency), interval: "1d", bars };
}

function linkFor(name: ToolName, value: string) {
  return name === "search_stocks"
    ? `https://finance.yahoo.com/lookup/?s=${encodeURIComponent(value)}`
    : `https://finance.yahoo.com/quote/${encodeURIComponent(value)}${name === "get_history" ? "/history/" : "/"}`;
}

/** Runs one tool. Never throws: failures come back as { ok: false, error }. */
export async function runTool(name: string, args: unknown): Promise<ToolResult> {
  const fetchedAt = () => new Date().toISOString();
  if (!isToolName(name)) {
    return { ok: false, error: `Unknown tool: ${name}.`, source: SOURCE, fetchedAt: fetchedAt() };
  }
  const checked = checkArgs(name, args);
  if (!checked.ok) return { ok: false, error: checked.error, source: SOURCE, fetchedAt: fetchedAt() };

  const link = linkFor(name, checked.value);
  try {
    const data =
      name === "search_stocks"
        ? await searchStocks(checked.value)
        : name === "get_quote"
          ? await getQuote(checked.value)
          : await getHistory(checked.value);
    return { ok: true, data, source: SOURCE, fetchedAt: fetchedAt(), link };
  } catch (error) {
    const detail = error instanceof Error && error.message.length < 200 ? ` (${error.message.replace(/\.$/, "")})` : "";
    console.error(`[tools] ${name} failed for ${checked.value}`);
    return {
      ok: false,
      error: `Yahoo Finance did not return data${detail}. No numbers are available for this call.`,
      source: SOURCE,
      fetchedAt: fetchedAt(),
      link,
    };
  }
}
