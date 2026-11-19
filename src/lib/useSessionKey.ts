"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { ProviderId } from "./providers";

/**
 * The visitor's API key for one provider, kept in sessionStorage only.
 * It disappears when the tab closes and is never written to localStorage or cookies.
 */
const storageKey = (provider: ProviderId) => `persona-chat:key:${provider}`;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readSessionKey(provider: ProviderId): string {
  try {
    return window.sessionStorage.getItem(storageKey(provider)) ?? "";
  } catch {
    return "";
  }
}

export function useSessionKey(provider: ProviderId) {
  const key = useSyncExternalStore(
    subscribe,
    () => readSessionKey(provider),
    () => "",
  );

  const setKey = useCallback(
    (value: string) => {
      try {
        const trimmed = value.trim();
        if (trimmed) window.sessionStorage.setItem(storageKey(provider), trimmed);
        else window.sessionStorage.removeItem(storageKey(provider));
      } catch {
        // Storage blocked (private mode etc.): the key simply won't persist.
      }
      listeners.forEach((l) => l());
    },
    [provider],
  );

  return [key, setKey] as const;
}
