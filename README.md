# Persona Chat

A small teaching app that shows the difference between a **system prompt** and a **user prompt**.

A student picks an AI character, asks a question, and sees how the system instruction changes Gemini's reply. The app shows the full system prompt, the user prompt, and the exact request (including conversation history) sent to the model.

> The characters are **AI simulations** inspired by Elon Musk, Marie Curie and the fictional Sherlock Holmes. They are not the real people, do not speak for them, and can get facts wrong. The portraits are simple illustrations, not photos.

## How it works

```
Browser                                   Next.js route              Gemini
───────                                   ─────────────              ──────
persona.systemInstruction ─┐
conversation so far        ├─ POST /api/chat ──► validate ──► generateContentStream({
new user prompt           ─┘   x-gemini-key header              config: { systemInstruction },
                                                                 contents: [...history, userPrompt] })
◄──────────── streamed Markdown text ◄──────────────────────────
```

1. **Choose a character.** Three chips, each mapped to a short, distinct system instruction (`src/lib/personas.ts`).
2. **System prompt.** The whole instruction is shown verbatim.
3. **User prompt.** The first question is pre-filled, so one click on **Send** works. Switching character starts a fresh chat and keeps the question, and the previous character's answer stays visible for comparison.
4. **What Gemini receives.** The system instruction, conversation history and user prompt from the last request, plus the raw JSON body.

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

Open http://localhost:3000. Either set `GEMINI_API_KEY` in `.env.local`, or paste a key into the **Settings** card ([get one here](https://aistudio.google.com/apikey)). A pasted key takes priority over the server key.

## API key handling

- A pasted key is stored only in the tab's `sessionStorage` and is cleared when the tab closes.
- It is sent to the server only in the `x-gemini-key` request header.
- The server uses it for that single request. It is never logged, stored or returned. Error messages are generic and never include the key.
- `GET /api/status` reports only whether a server key exists, never its value.

## Limits and validation

Set in `src/lib/limits.ts` and enforced in `src/lib/validation.ts`:

| Rule | Value |
| --- | --- |
| Characters per message | 2,000 |
| Messages per request | 20 (10 exchanges) |
| Total conversation characters | 24,000 |
| Request body size | 64 KB |
| Models | `gemini-3.8-flash` (default), `gemini-3.5-flash-lite` |

The system instruction in a request must exactly match one of the three personas, and messages must alternate user/model and end with a user turn. This keeps the route from being used as a general prompt proxy.

## Project layout

```
src/
  app/
    page.tsx                 Screen entry
    layout.tsx               Geist font, metadata
    globals.css              Tailwind 4 theme, glow, Markdown styles
    api/chat/route.ts        POST: validate, call Gemini, stream text
    api/status/route.ts      GET: is a server key configured?
  lib/
    personas.ts              Persona definitions and starter question
    models.ts                Allowed models
    gemini.ts                Gemini call (@google/genai) and safe error messages
    validation.ts            Request validation
    limits.ts                Length caps
    chat-types.ts            Shared request types
    streamChat.ts            Browser helper that reads the streamed reply
    useSessionKey.ts         sessionStorage-backed API key
  components/
    PersonaChat.tsx          Screen state and layout
    PersonaPicker.tsx        Character chips and card
    SystemPromptCard.tsx     Full system prompt
    ChatPanel.tsx            Auto-scrolling chat and user prompt composer
    MessageBubble.tsx        One message, Markdown for replies
    RequestInspector.tsx     Exact request sent
    ComparisonCard.tsx       Previous character's answer
    SettingsCard.tsx         API key and model
    Portrait.tsx, Markdown.tsx, Card.tsx, CopyButton.tsx
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

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, lucide-react, react-markdown with remark-gfm, and `@google/genai`.

## Status

The UI and the server's validation and error handling have been tested. A full reply from Gemini has not yet been recorded, because that needs a real API key. A recorded demo will be added after a real run.
