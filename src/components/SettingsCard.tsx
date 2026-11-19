"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, ShieldCheck, X } from "lucide-react";
import { MODELS, type ModelId } from "@/lib/models";
import { Card, StepLabel } from "./Card";

/** Gemini API key (sessionStorage only) and model choice. */
export function SettingsCard({
  apiKey,
  onApiKeyChange,
  model,
  onModelChange,
  disabled,
}: {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  model: ModelId;
  onModelChange: (model: ModelId) => void;
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [serverKey, setServerKey] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/status")
      .then((r) => r.json() as Promise<{ serverKey: boolean }>)
      .then((d) => !cancelled && setServerKey(d.serverKey))
      .catch(() => !cancelled && setServerKey(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const status = apiKey
    ? "Using your key from this tab."
    : serverKey
      ? "Using the server key from .env.local."
      : serverKey === false
        ? "No key yet. Paste one to start."
        : "";

  return (
    <Card className="p-5">
      <StepLabel title="Settings" />

      <label htmlFor="gemini-key" className="mt-4 flex items-center gap-1.5 text-xs font-medium text-ink/80">
        <KeyRound className="size-3.5" strokeWidth={1.75} aria-hidden />
        Gemini API key
      </label>
      <div className="mt-1.5 flex items-center gap-1 rounded-full border border-line bg-white pl-3.5 pr-1 focus-within:border-black/30">
        <input
          id="gemini-key"
          type={visible ? "text" : "password"}
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          placeholder={serverKey ? "Optional — server key configured" : "Paste your key"}
          autoComplete="off"
          spellCheck={false}
          className="h-9 min-w-0 flex-1 bg-transparent font-mono text-sm outline-none placeholder:font-sans placeholder:text-muted/70"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide key" : "Show key"}
          className="grid size-7 place-items-center rounded-full text-muted hover:bg-page hover:text-ink"
        >
          {visible ? <EyeOff className="size-4" strokeWidth={1.75} /> : <Eye className="size-4" strokeWidth={1.75} />}
        </button>
        {apiKey && (
          <button
            type="button"
            onClick={() => onApiKeyChange("")}
            aria-label="Clear key"
            className="grid size-7 place-items-center rounded-full text-muted hover:bg-page hover:text-ink"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        )}
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-muted">
        <ShieldCheck className="mt-px size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
        <span>
          Kept in this tab&apos;s sessionStorage and sent only in the <code className="font-mono">x-gemini-key</code>{" "}
          header. The server never logs or saves it. {status}{" "}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="underline underline-offset-2">
            Get a key
          </a>
        </span>
      </p>

      <fieldset className="mt-5" disabled={disabled}>
        <legend className="text-xs font-medium text-ink/80">Model</legend>
        <div className="mt-1.5 inline-flex rounded-full border border-line bg-page/60 p-1">
          {MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onModelChange(m.id)}
              aria-pressed={model === m.id}
              title={m.hint}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                model === m.id ? "bg-ink text-white" : "text-muted hover:text-ink"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </fieldset>
    </Card>
  );
}
