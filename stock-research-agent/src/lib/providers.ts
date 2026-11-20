/**
 * AI providers the visitor can switch between. Safe to import in the browser:
 * only names, model IDs and header names, never keys.
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
  keyPlaceholder: string;
  keyUrl: string;
  models: readonly ModelOption[];
  defaultModel: string;
}

export const PROVIDERS: readonly Provider[] = [
  {
    id: "gemini",
    label: "Gemini",
    keyHeader: "x-gemini-key",
    keyPlaceholder: "AIza…",
    keyUrl: "https://aistudio.google.com/apikey",
    models: [
      { id: "gemini-3.8-flash", label: "3.8 Flash" },
      { id: "gemini-3.5-flash-lite", label: "3.5 Flash-Lite" },
    ],
    defaultModel: "gemini-3.8-flash",
  },
  {
    id: "anthropic",
    label: "Claude",
    keyHeader: "x-anthropic-key",
    keyPlaceholder: "sk-ant-…",
    keyUrl: "https://platform.claude.com/settings/keys",
    models: [
      { id: "claude-opus-5-5", label: "Opus 5.5" },
      { id: "claude-sonnet-5-5", label: "Sonnet 5.5" },
      { id: "claude-haiku-5-5", label: "Haiku 5.5" },
    ],
    defaultModel: "claude-opus-5-5",
  },
  {
    id: "openai",
    label: "OpenAI",
    keyHeader: "x-openai-key",
    keyPlaceholder: "sk-…",
    keyUrl: "https://platform.openai.com/api-keys",
    models: [
      { id: "gpt-5.5", label: "GPT-5.5" },
      { id: "gpt-5.4", label: "GPT-5.4" },
    ],
    defaultModel: "gpt-5.5",
  },
  {
    id: "groq",
    label: "Groq",
    keyHeader: "x-groq-key",
    keyPlaceholder: "gsk_…",
    keyUrl: "https://console.groq.com/keys",
    models: [
      { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B" },
      { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B" },
    ],
    defaultModel: "openai/gpt-oss-120b",
  },
];

export function getProvider(id: unknown): Provider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/** Only the listed models are accepted, so the route can't be pointed at anything else. */
export function isListedModel(provider: Provider, model: unknown): model is string {
  return provider.models.some((m) => m.id === model);
}

export function modelLabel(providerId: ProviderId, model: string): string {
  const p = getProvider(providerId);
  const m = p?.models.find((x) => x.id === model);
  return p && m ? `${p.label} ${m.label}` : model;
}
