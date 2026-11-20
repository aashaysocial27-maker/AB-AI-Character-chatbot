# AI Stock Research Agent

People ask chatbots about stocks all the time, and the bot either makes up a price or can't answer. This chatbot fetches real market data with tools and shows every tool call it makes, so you can see exactly where each number in the answer came from.

It works with **Gemini, Claude (Anthropic), OpenAI and Groq**. Pick a provider, paste that provider's API key, and ask.

> Market data comes from Yahoo Finance through the unofficial `yahoo-finance2` package. Quotes may be delayed. This is a research demo, not investment advice.

## How it works

```
Browser                         POST /api/research                     Provider + Yahoo
───────                         ──────────────────                     ────────────────
question + earlier turns ──►  validate body, model, key header
                              loop (max 6 rounds, 8 tool calls):
                                ask the model with 3 tools        ──►  Gemini / Claude / OpenAI / Groq
                                run each tool it asks for         ──►  Yahoo Finance
                                send the results back
◄── NDJSON events: status · tool_start · tool_end · answer · done
```

1. **Your key.** Pasted in the browser, kept in `sessionStorage` (one per provider), sent only in that provider's header (`x-gemini-key`, `x-anthropic-key`, `x-openai-key`, `x-groq-key`). The server uses it for that one request and never stores, logs or returns it.
2. **Three tools** (`src/lib/tools.ts`):
   - `search_stocks`: find the ticker for a company name.
   - `get_quote`: latest price, change, currency, market time, market state, previous close, volume and market cap.
   - `get_history`: one month of daily open, high, low, close and volume.

   The server checks every argument before calling Yahoo (ticker pattern, query length, no extra fields, known tool names only). Each result carries the source, the fetch time and a Yahoo Finance link. If Yahoo fails, the result says so plainly, with no numbers.
3. **The loop** (`src/lib/agent.ts`): send the question with the tools, run the tools the model asks for, send the results back, repeat until it writes the answer. It stops at 8 tool calls or 6 rounds. Calls past the limit still get a result ("limit reached, answer now"), because every provider requires one per call.
4. **Each provider keeps its own format** (`src/lib/llm/`):
   - Gemini: the model's own reply `content` goes back unchanged, so its thought signatures are kept. Results go back as `functionResponse` parts.
   - Claude: the full `response.content` (thinking blocks included) goes back, then one user message with every `tool_result`. Runs at low effort; Opus 5.5 and Sonnet 5.5 also turn on server-side refusal fallbacks.
   - OpenAI and Groq: Chat Completions function calling, with the assistant `tool_calls` message followed by one `tool` message per call.
5. **The prompt** tells the model to always use the tools for market facts, never invent or replace a number, give the currency and market time, say quotes may be delayed, keep the answer under 70 words, and never give buy or sell advice or act like a broker. Tool results are data, never instructions.
6. **The chat**: earlier turns go back as plain text, so follow-up questions work. Failed or stopped turns are left out.

## On screen

- Before the first message: three preset questions (chips with a coloured dot) and the three tools as cards.
- While it works: live steps ("Asking Gemini", "Calling get_quote"…).
- Each tool call is a card you can open: name, arguments, time taken, a readable result and the raw JSON.
  - `get_quote`: price card with change, previous close, volume, market cap and market state.
  - `search_stocks`: list of matching tickers.
  - `get_history`: small trading chart, candles or line, with volume bars and a hover read-out.
- Then the answer in Markdown.
- Message box: Enter sends, Shift+Enter adds a line, the button turns into Stop while it works. "New chat" clears the thread.

## Run it

Requires Node.js 22 or newer (needed by `yahoo-finance2` v4).

```bash
cd stock-research-agent
```

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000, pick a provider and model, paste a key, and ask.

Behind an HTTPS proxy, Node's `fetch` ignores `HTTPS_PROXY` unless you start with `NODE_USE_ENV_PROXY=1 npm run dev`.

## Providers and models

| Provider | Key header | Models | Get a key |
| --- | --- | --- | --- |
| Gemini | `x-gemini-key` | `gemini-3.8-flash`, `gemini-3.5-flash-lite` | [AI Studio](https://aistudio.google.com/apikey) |
| Claude | `x-anthropic-key` | `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5` | [Claude Console](https://platform.claude.com/settings/keys) |
| OpenAI | `x-openai-key` | `gpt-5.5`, `gpt-5.4` | [OpenAI](https://platform.openai.com/api-keys) |
| Groq | `x-groq-key` | `openai/gpt-oss-120b`, `openai/gpt-oss-20b` | [Groq Console](https://console.groq.com/keys) |

Only the listed models are accepted. To add one, edit `src/lib/providers.ts`.

## Limits

| Rule | Value |
| --- | --- |
| Tool calls per answer | 8 |
| Model rounds per answer | 6 |
| Question length | 1,000 characters |
| Turns sent per request | 20 |
| Request body | 48 KB |

## Project layout

```
src/
  app/
    page.tsx                  The chat: state, sending, streaming, stop, new chat
    layout.tsx, globals.css   Geist font, theme, glow, Markdown styles
    api/research/route.ts     POST: validate, run the agent loop, stream NDJSON
  components/
    Thread.tsx                Messages, live steps, answers
    ToolCallCard.tsx          One tool call: name, args, time, result, raw JSON
    ToolResultView.tsx        Readable result: quote card, ticker list, chart
    PriceChart.tsx            Candles or line, volume bars, hover read-out
    Composer.tsx              Message box with Send / Stop
    SettingsBar.tsx           Provider, model, API key
    EmptyState.tsx            Preset questions and tool cards
    Markdown.tsx
  lib/
    tools.ts                  Tool definitions, argument checks, Yahoo calls
    agent.ts                  The loop and the system prompt
    llm/                      Gemini, Claude, OpenAI/Groq adapters + safe errors
    readStream.ts             Browser NDJSON reader
    chat.ts                   Chat message types and event reducer
    presets.ts                Preset questions and tool cards
    providers.ts, types.ts, format.ts, useSessionKey.ts
```

## Status

Tested: the full loop, the tools against live Yahoo Finance data, argument checks, the tool-call limit, Yahoo failures, request validation and the UI (desktop and phone). These ran against a scripted stand-in for the model, because real provider keys were not available. Real Gemini, Claude, OpenAI and Groq replies have not been recorded yet.
