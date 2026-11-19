/** Gemini models the student can choose between. The route only accepts these. */
export const MODELS = [
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash", hint: "Default" },
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite", hint: "Faster, lighter" },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

export const DEFAULT_MODEL: ModelId = "gemini-3.8-flash";

export function isModelId(value: unknown): value is ModelId {
  return MODELS.some((m) => m.id === value);
}
