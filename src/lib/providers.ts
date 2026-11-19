/**
 * AI providers the student can switch between. Safe to import in the browser:
 * contains no keys, only names, model IDs and how each API labels the prompts.
 */

export type ProviderId = "gemini" | "anthropic" | "openai" | "groq";

export interface ModelOption {
  id: string;
  label: string;
}

export interface Provider {
  id: ProviderId;
  label: string;
  /** Request header that carries the visitor's own key for this provider. */
  keyHeader: string;
  /** Server-side fallback variable in .env.local. */
  envVar: string;
  keyPlaceholder: string;
  keyUrl: string;
  models: readonly ModelOption[];
  defaultModel: string;
  /** How this provider's API names the pieces, shown in the request inspector. */
  fields: {
    system: string;
    history: string;
    assistantRole: string;
  };
}

export const PROVIDERS: readonly Provider[] = [
  {
    id: "gemini",
    label: "Gemini",
    keyHeader: "x-gemini-key",
    envVar: "GEMINI_API_KEY",
    keyPlaceholder: "AIza…",
    keyUrl: "https://aistudio.google.com/apikey",
    models: [
      { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash" },
      { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite" },
    ],
    defaultModel: "gemini-3.8-flash",
    fields: { system: "config.systemInstruction", history: "contents", assistantRole: "model" },
  },
  {
    id: "anthropic",
    label: "Anthropic",
    keyHeader: "x-anthropic-key",
    envVar: "ANTHROPIC_API_KEY",
    keyPlaceholder: "sk-ant-…",
    keyUrl: "https://platform.claude.com/settings/keys",
    models: [
      { id: "claude-opus-5-5", label: "Claude Opus 5.5" },
      { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
      { id: "claude-haiku-5-5", label: "Claude Haiku 5.5" },
    ],
    defaultModel: "claude-opus-5-5",
    fields: { system: "system", history: "messages", assistantRole: "assistant" },
  },
  {
    id: "openai",
    label: "OpenAI",
    keyHeader: "x-openai-key",
    envVar: "OPENAI_API_KEY",
    keyPlaceholder: "sk-…",
    keyUrl: "https://platform.openai.com/api-keys",
    models: [
      { id: "gpt-5.5", label: "GPT-5.5" },
      { id: "gpt-5.4", label: "GPT-5.4" },
    ],
    defaultModel: "gpt-5.5",
    fields: { system: 'messages[0] (role "system")', history: "messages", assistantRole: "assistant" },
  },
  {
    id: "groq",
    label: "Groq",
    keyHeader: "x-groq-key",
    envVar: "GROQ_API_KEY",
    keyPlaceholder: "gsk_…",
    keyUrl: "https://console.groq.com/keys",
    models: [
      { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B" },
      { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B" },
    ],
    defaultModel: "openai/gpt-oss-120b",
    fields: { system: 'messages[0] (role "system")', history: "messages", assistantRole: "assistant" },
  },
];

export const DEFAULT_PROVIDER: ProviderId = "gemini";

export function getProvider(id: unknown): Provider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/**
 * Model names change often, so besides the listed models the student may type
 * a custom ID. It must look like a model name: letters, digits and . _ - / :
 */
const CUSTOM_MODEL = /^[A-Za-z0-9][A-Za-z0-9._\-/:]{1,99}$/;

export function isValidModel(model: unknown): model is string {
  return typeof model === "string" && CUSTOM_MODEL.test(model);
}
