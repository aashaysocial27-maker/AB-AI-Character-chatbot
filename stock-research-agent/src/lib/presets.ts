import type { ToolName } from "./types";

export const PRESETS = [
  { label: "Apple's latest price", dot: "bg-emerald-400", question: "What is Apple's latest stock price?" },
  {
    label: "Compare two Indian stocks",
    dot: "bg-orange-300",
    question: "Compare Infosys and TCS on the NSE: latest price and today's change.",
  },
  {
    label: "Microsoft's month of prices",
    dot: "bg-sky-400",
    question: "How has Microsoft's stock moved over the last month?",
  },
] as const;

export const TOOL_INFO: { name: ToolName; title: string; text: string }[] = [
  { name: "search_stocks", title: "Find a ticker", text: "Company name to ticker symbol and exchange." },
  { name: "get_quote", title: "Latest quote", text: "Price, change, currency, market time, volume, market cap." },
  { name: "get_history", title: "One month", text: "Daily open, high, low, close and volume." },
];
