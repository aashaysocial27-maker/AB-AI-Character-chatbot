"use client";

import { useEffect, useState } from "react";
import { Cpu, Eye, EyeOff, KeyRound, ShieldCheck, X } from "lucide-react";
import { PROVIDERS, getProvider, isValidModel, type ProviderId } from "@/lib/providers";
import { Card, StepLabel } from "./Card";

/** Provider, API key (sessionStorage only, one per provider) and model. */
export function SettingsCard({
  provider: providerId,
  onProviderChange,
  apiKey,
  onApiKeyChange,
  model,
  onModelChange,
  disabled,
}: {
  provider: ProviderId;
  onProviderChange: (provider: ProviderId) => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  model: string;
  onModelChange: (model: string) => void;
  disabled?: boolean;
}) {
  const provider = getProvider(providerId)!;
  const [visible, setVisible] = useState(false);
  const [serverKeys, setServerKeys] = useState<Partial<Record<ProviderId, boolean>> | null>(null);
  const isListed = provider.models.some((m) => m.id === model);
  const [customOpen, setCustomOpen] = useState(!isListed);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/status")
      .then((r) => r.json() as Promise<{ serverKeys: Record<ProviderId, boolean> }>)
      .then((d) => !cancelled && setServerKeys(d.serverKeys))
      .catch(() => !cancelled && setServerKeys({}));
    return () => {
      cancelled = true;
    };
  }, []);

  const serverKey = serverKeys?.[providerId];
  const status = apiKey
    ? `Using your ${provider.label} key from this tab.`
    : serverKey
      ? `Using the server key (${provider.envVar}) from .env.local.`
      : serverKeys
        ? `No ${provider.label} key yet. Paste one to start.`
        : "";

  return (
    <Card className="p-5">
      <StepLabel title="Settings" hint="Use any provider. Each key is kept separately in this tab." />

      <fieldset className="mt-4" disabled={disabled}>
        <legend className="flex items-center gap-1.5 text-xs font-medium text-ink/80">
          <Cpu className="size-3.5" strokeWidth={1.75} aria-hidden />
          Provider
        </legend>
        <div className="mt-1.5 grid grid-cols-4 gap-1 rounded-full border border-line bg-page/60 p-1">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onProviderChange(p.id);
                setCustomOpen(false);
              }}
              aria-pressed={providerId === p.id}
              className={`rounded-full px-2 py-1 text-xs transition-colors disabled:opacity-50 ${
                providerId === p.id ? "bg-ink text-white" : "text-muted hover:text-ink"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label htmlFor="api-key" className="mt-5 flex items-center gap-1.5 text-xs font-medium text-ink/80">
        <KeyRound className="size-3.5" strokeWidth={1.75} aria-hidden />
        {provider.label} API key
      </label>
      <div className="mt-1.5 flex items-center gap-1 rounded-full border border-line bg-white pl-3.5 pr-1 focus-within:border-black/30">
        <input
          id="api-key"
          type={visible ? "text" : "password"}
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          placeholder={serverKey ? "Optional — server key configured" : `Paste your key (${provider.keyPlaceholder})`}
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
          Kept in this tab&apos;s sessionStorage and sent only in the{" "}
          <code className="font-mono">{provider.keyHeader}</code> header. The server never logs or saves it. {status}{" "}
          <a href={provider.keyUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            Get a key
          </a>
        </span>
      </p>

      <fieldset className="mt-5" disabled={disabled}>
        <legend className="text-xs font-medium text-ink/80">Model</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {provider.models.map((m) => {
            const active = !customOpen && model === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setCustomOpen(false);
                  onModelChange(m.id);
                }}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  active ? "border-ink bg-ink text-white" : "border-line text-muted hover:text-ink"
                }`}
              >
                {m.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setCustomOpen(true)}
            aria-pressed={customOpen}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              customOpen ? "border-ink bg-ink text-white" : "border-dashed border-line text-muted hover:text-ink"
            }`}
          >
            Custom
          </button>
        </div>
        {customOpen && (
          <CustomModelInput
            key={providerId}
            initial={isListed ? "" : model}
            placeholder={provider.defaultModel}
            onCommit={onModelChange}
          />
        )}
        <p className="mt-2 font-mono text-[11px] text-muted">model: {model}</p>
      </fieldset>
    </Card>
  );
}

/** Free-text model ID, for models released after this app was written. */
function CustomModelInput({
  initial,
  placeholder,
  onCommit,
}: {
  initial: string;
  placeholder: string;
  onCommit: (model: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const valid = isValidModel(value.trim());
  return (
    <div className="mt-2">
      <label htmlFor="custom-model" className="sr-only">
        Custom model ID
      </label>
      <input
        id="custom-model"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          const v = e.target.value.trim();
          if (isValidModel(v)) onCommit(v);
        }}
        placeholder={`Model ID, e.g. ${placeholder}`}
        spellCheck={false}
        autoComplete="off"
        className="h-9 w-full rounded-full border border-line bg-white px-3.5 font-mono text-sm outline-none placeholder:font-sans placeholder:text-muted/70 focus:border-black/30"
      />
      {value && !valid && (
        <p className="mt-1 text-[11px] text-[#b4541c]">Use letters, digits and . _ - / : only.</p>
      )}
    </div>
  );
}
