"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * The visitor's Gemini key, kept in sessionStorage only.
 * It disappears when the tab closes and is never written to localStorage or cookies.
 */
const STORAGE_KEY = "persona-chat:gemini-key";
const listeners = new Set<() => void>();

function read(): string {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSessionKey() {
  const key = useSyncExternalStore(subscribe, read, () => "");

  const setKey = useCallback((value: string) => {
    try {
      const trimmed = value.trim();
      if (trimmed) window.sessionStorage.setItem(STORAGE_KEY, trimmed);
      else window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage blocked (private mode etc.): the key simply won't persist.
    }
    listeners.forEach((l) => l());
  }, []);

  return [key, setKey] as const;
}
