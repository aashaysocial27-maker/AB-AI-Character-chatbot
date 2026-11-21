# Persona Chat

A small teaching app that shows the difference between a **system prompt** and a **user prompt**.

A student picks an AI character, asks a question, and sees how the system instruction changes the reply. It works with **Gemini, Anthropic (Claude), OpenAI and Groq**: pick a provider, paste that provider's key, and compare answers. The app shows the full system prompt, the user prompt, and the exact request (including conversation history) sent to the model.

> The characters are **AI simulations** inspired by Elon Musk, Marie Curie and the fictional Sherlock Holmes. They are not the real people, do not speak for them, and can get facts wrong. The portraits are simple illustrations, not photos.

## Book Reader (`/reader`)

A second app in the same project: add a PDF and it becomes a chaptered book that reads itself aloud.

- **PDF → book.** The PDF is parsed in the browser with pdf.js. Running headers and page numbers are removed, hyphenated words rejoined and lines reflowed into paragraphs, shown as two facing pages (one on phones). An **Original** view shows the exact printed pages, with the sentence and word being read highlighted on the page itself; tap a line there to read from it.
- **Chapters.** Taken from the PDF's bookmarks when it has them, otherwise found from headings ("Chapter 3", "Prologue", large titles), otherwise grouped by pages.
- **Read aloud.** Two voices behind the same controls:
  - **Device voice** (free, offline): the most natural voice your device offers (Edge/Chrome "Natural"/"Online", Apple "Premium"/"Enhanced").
  - **OpenAI voice** (most natural): paste your OpenAI key in the player's voice settings (kept in the tab only), or set `OPENAI_API_KEY` on the server. Uses `gpt-4o-mini-tts` through `POST /api/tts`, with a choice of narrators. Clips are cached in the browser, so re-listening costs nothing.
  - **Reading style:** *Storyteller* (expressive, with pauses and livelier dialogue), *Teacher* (slower and clear) or *Plain*. The OpenAI voice is told the style; the device voice gets matching pace, pitch and pauses.
  - **Teacher explains:** after each page or at the end of a chapter, reading pauses, the AI explains what you just heard in a few spoken sentences and asks a question to think about, then reading carries on.
  - Pause, play and resume from the same word; skip sentences or chapters; change speed; click any sentence to read from there. The next chapter starts automatically, and headphone buttons work.
- **Progress.** Only sentences you actually listen to count; skipping ahead doesn't. Each chapter shows a progress ring and *Not started / % read / Completed*, the book shows % read and which pages are done, and the library shows a bar per book. Mark a chapter read or unread by hand, or reset. When you reopen a book, a card offers to **Continue where you stopped**. The bookmark button in the player (**Stop here**) saves your place; bookmarks are listed under Chapters → Bookmarks.
- **Ask questions.** Summarise a chapter, explain the passage you just heard, quiz yourself, or ask anything. The AI gets the current chapter's text and sentence (`POST /api/ask`, same providers and keys as Persona Chat; Claude Sonnet 5.5 by default). Answers can be read aloud.
- **Word bank.** Double-click (or long-press) a word → **Save word**. It keeps the sentence and chapter, fetches a dictionary meaning (dictionaryapi.dev) and can **Explain in context** with the AI. Practice mode hides meanings for self-testing; export as CSV.
- **Remembers.** Books are stored in this browser (IndexedDB), with your reading position, word bank and voice settings (localStorage). Nothing is uploaded except the chapter text sent to the AI when you ask a question.

Claude has no speech API, so the voice comes from the browser's Speech Synthesis. Scanned PDFs (images without text) open in the Original view but have nothing to read aloud.

## How it works

```
Browser                               Next.js route           Provider API
───────                               ─────────────           ────────────
provider + model         ─┐
persona.systemInstruction ├─ POST /api/chat ─► validate ─►  Gemini:    config.systemInstruction + contents
conversation so far       │  x-<provider>-key header         Anthropic: system + messages
new user prompt          ─┘                                  OpenAI/Groq: messages[0] role "system" + messages
◄──────────── streamed Markdown text ◄──────────────────────
```

1. **Choose a character.** Three chips, each mapped to a short, distinct system instruction (`src/lib/personas.ts`).
2. **System prompt.** The whole instruction is shown verbatim.
3. **User prompt.** The first question is pre-filled, so one click on **Send** works. Switching character starts a fresh chat and keeps the question, and the previous character's answer stays visible for comparison.
4. **What the provider receives.** The system instruction, conversation history and user prompt from the last request, labelled with the field names that provider uses, plus the raw JSON body.

## Run it locally

Requires Node.js 20.9 or newer.

```bash
npm install
```

```bash
cp .env.example .env.local   # optional: add GEMINI_API_KEY
```

```bash
npm run dev
```

Open http://localhost:3000. In **Settings**, pick a provider and paste its key, or set the matching variable in `.env.local`. A pasted key takes priority over the server key.

## Providers and models

| Provider | Key header | `.env.local` variable | Listed models | Get a key |
| --- | --- | --- | --- | --- |
| Gemini | `x-gemini-key` | `GEMINI_API_KEY` | `gemini-3.8-flash`, `gemini-3.5-flash-lite` | [AI Studio](https://aistudio.google.com/apikey) |
| Anthropic | `x-anthropic-key` | `ANTHROPIC_API_KEY` | `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5` | [Claude Console](https://platform.claude.com/settings/keys) |
| OpenAI | `x-openai-key` | `OPENAI_API_KEY` | `gpt-5.5`, `gpt-5.4` | [OpenAI](https://platform.openai.com/api-keys) |
| Groq | `x-groq-key` | `GROQ_API_KEY` | `openai/gpt-oss-120b`, `openai/gpt-oss-20b` | [Groq Console](https://console.groq.com/keys) |

Model names change often, so **Custom** lets the student type any model ID the provider offers. Each reply in the chat is labelled with the provider and model that wrote it, and the request inspector shows where each API puts the system prompt.

Notes:

- **Anthropic** calls run at low effort for quick chat replies. On Opus 5.5 and Sonnet 5.5 they also turn on server-side refusal fallbacks: if a safety check declines, the API retries on a fallback model in the same call. If the whole chain declines, the reply ends with a short note.
- **OpenAI and Groq** use the same Chat Completions format (Groq through its OpenAI-compatible endpoint).

## API key handling

- A pasted key is stored only in the tab's `sessionStorage` (one per provider) and is cleared when the tab closes.
- It is sent to the server only in that provider's request header (see the table above).
- The server uses it for that single request. It is never logged, stored or returned. Error messages are generic and never include the key.
- `GET /api/status` reports only which providers have a server key, never the values.

## Limits and validation

Set in `src/lib/limits.ts` and enforced in `src/lib/validation.ts`:

| Rule | Value |
| --- | --- |
| Characters per message | 2,000 |
| Messages per request | 20 (10 exchanges) |
| Total conversation characters | 24,000 |
| Request body size | 64 KB |
| Provider | One of the four above |
| Model ID | Letters, digits and `. _ - / :`, up to 100 characters |

The system instruction in a request must exactly match one of the three personas, and messages must alternate user/model and end with a user turn. This keeps the route from being used as a general prompt proxy.

## Project layout

```
src/
  app/
    page.tsx                 Screen entry
    layout.tsx               Geist font, metadata
    globals.css              Tailwind 4 theme, glow, Markdown styles
    api/chat/route.ts        POST: validate, call the chosen provider, stream text
    api/status/route.ts      GET: is a server key configured?
    api/ask/route.ts         POST: Book Reader questions, word and teacher explanations
    api/tts/route.ts         POST: OpenAI text-to-speech for the reader
    reader/                  Book Reader page (browser-only)
  lib/
    personas.ts              Persona definitions and starter question
    providers.ts             Providers, models, key headers, API field names
    llm/gemini.ts            Gemini call (@google/genai)
    llm/anthropic.ts         Anthropic call (@anthropic-ai/sdk)
    llm/openai-compatible.ts OpenAI and Groq calls (openai)
    llm/index.ts             Provider dispatch and safe error messages
    validation.ts            Request validation
    limits.ts                Length caps
    chat-types.ts            Shared request types
    streamChat.ts            Browser helper that reads the streamed reply
    useSessionKey.ts         sessionStorage-backed API key
    reader/extract.ts        PDF → positioned text lines → book (pdf.js)
    reader/layout.ts         Header/footer removal, reflow, chapter detection, sentence split
    reader/useSpeech.ts      Read-aloud engine: sentence queue, pause/resume at the word
    reader/storage.ts        IndexedDB books, localStorage progress/words/settings
    reader/ask.ts            /api/ask client, dictionary lookup, chapter context
    reader/positions.ts      Sentence/word → boxes on the original PDF page, and back
    reader/progress.ts       Heard sentences, chapter/page progress, bookmarks
    reader/voice-options.ts  Reading styles, OpenAI voices and style instructions
  components/
    PersonaChat.tsx          Screen state and layout
    PersonaPicker.tsx        Character chips and card
    SystemPromptCard.tsx     Full system prompt
    ChatPanel.tsx            Auto-scrolling chat and user prompt composer
    MessageBubble.tsx        One message, Markdown for replies
    RequestInspector.tsx     Exact request sent
    ComparisonCard.tsx       Previous character's answer
    SettingsCard.tsx         Provider, API key and model
    Portrait.tsx, Markdown.tsx, Card.tsx, CopyButton.tsx
    reader/                  BookReader, Library, BookView, PageView, PlayerBar, AskPanel, WordBank
public/portraits/            Illustrated SVG portraits
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, lucide-react, react-markdown with remark-gfm, `@google/genai`, `@anthropic-ai/sdk` and `openai`.

## Status

The UI and the server's validation and error handling have been tested. Real replies have not yet been recorded from any provider, because that needs real API keys. The OpenAI and Groq model IDs were not verified against those providers' live model lists; use **Custom** if one is not available. A recorded demo will be added after a real run.
