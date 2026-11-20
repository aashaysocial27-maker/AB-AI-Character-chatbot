"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { PROVIDERS, getProvider, type ProviderId } from "@/lib/providers";

/** Provider pills, model switch and the provider's API key (sessionStorage only). */
export function SettingsBar({
  providerId,
  model,
  apiKey,
  disabled,
  onProvider,
  onModel,
  onKey,
}: {
  providerId: ProviderId;
  model: string;
  apiKey: string;
  disabled: boolean;
  onProvider: (id: ProviderId) => void;
  onModel: (id: string) => void;
  onKey: (key: string) => void;
}) {
  const [show, setShow] = useState(false);
  const provider = getProvider(providerId)!;

  return (
    <div className="rounded-3xl border border-black/[0.04] bg-white p-3 shadow-card sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-full bg-black/[0.04] p-1" role="radiogroup" aria-label="Provider">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={p.id === providerId}
              disabled={disabled}
              onClick={() => onProvider(p.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition disabled:opacity-50 ${
                p.id === providerId ? "bg-ink text-white" : "text-muted hover:text-ink"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Model">
          {provider.models.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={m.id === model}
              disabled={disabled}
              onClick={() => onModel(m.id)}
              className={`rounded-full border px-3 py-1 text-xs transition disabled:opacity-50 ${
                m.id === model ? "border-ink font-medium" : "border-line text-muted hover:text-ink"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-line px-3 focus-within:border-black/30">
        <KeyRound className="size-4 shrink-0 text-muted" />
        <input
          type={show ? "text" : "password"}
          value={apiKey}
          onChange={(e) => onKey(e.target.value)}
          placeholder={`${provider.label} API key (${provider.keyPlaceholder})`}
          aria-label={`${provider.label} API key`}
          autoComplete="off"
          spellCheck={false}
          className="h-9 min-w-0 flex-1 bg-transparent font-mono text-xs outline-none placeholder:font-sans placeholder:text-muted"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide key" : "Show key"}
          className="text-muted hover:text-ink"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <p className="mt-2 px-1 text-[11px] leading-relaxed text-muted">
        Kept in this tab only (sessionStorage) and sent with each request. Never saved or logged.{" "}
        <a href={provider.keyUrl} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 hover:text-ink">
          Get an API key
        </a>
      </p>
    </div>
  );
}
