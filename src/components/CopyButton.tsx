"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard unavailable; nothing to do.
        }
      }}
      className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-muted transition-colors hover:text-ink"
    >
      {copied ? <Check className="size-3.5" strokeWidth={1.75} /> : <Copy className="size-3.5" strokeWidth={1.75} />}
      {copied ? "Copied" : label}
    </button>
  );
}
