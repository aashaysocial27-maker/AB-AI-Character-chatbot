"use client";

import { DEFAULT_TTS_MODEL, type CheckIns, type ReadingStyle, type VoiceEngine } from "./voice-options";
import type { BookSummary, ParsedBook, ReadingProgress, StoredBook, WordEntry } from "./types";

/**
 * Books (the parsed chapters plus the original PDF) live in IndexedDB in this
 * browser. Reading progress, the word bank and voice settings live in
 * localStorage. Nothing is uploaded.
 */

const DB_NAME = "book-reader";
const STORE = "books";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    t.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    t.onerror = () => {
      db.close();
      reject(t.error);
    };
  });
}

export async function saveBook(book: ParsedBook, file: Blob): Promise<void> {
  const stored: StoredBook = { ...book, file, addedAt: Date.now() };
  await tx("readwrite", (s) => s.put(stored));
}

export async function loadBook(id: string): Promise<StoredBook | undefined> {
  try {
    return await tx<StoredBook | undefined>("readonly", (s) => s.get(id));
  } catch {
    return undefined;
  }
}

export async function listBooks(): Promise<BookSummary[]> {
  try {
    const all = await tx<StoredBook[]>("readonly", (s) => s.getAll());
    return all
      .map((b) => ({
        id: b.id,
        title: b.title,
        author: b.author,
        pageCount: b.pageCount,
        chapterCount: b.chapters.length,
        addedAt: b.addedAt,
      }))
      .sort((a, b) => b.addedAt - a.addedAt);
  } catch {
    return [];
  }
}

export async function deleteBook(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
  removeItem(`reader:progress:${id}`);
}

// ---- localStorage helpers ----

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the app still works, it just won't remember.
  }
}

function removeItem(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export const getProgress = (bookId: string) => readJson<ReadingProgress | null>(`reader:progress:${bookId}`, null);
export const setProgress = (bookId: string, p: ReadingProgress) => writeJson(`reader:progress:${bookId}`, p);

export const getWords = () => readJson<WordEntry[]>("reader:words", []);
export const setWords = (words: WordEntry[]) => writeJson("reader:words", words);

export interface VoiceSettings {
  voiceURI: string;
  rate: number;
  pitch: number;
  engine: VoiceEngine;
  style: ReadingStyle;
  openaiVoice: string;
  openaiModel: string;
  checkIns: CheckIns;
}
const DEFAULT_VOICE: VoiceSettings = {
  voiceURI: "",
  rate: 1,
  pitch: 1,
  engine: "device",
  style: "storyteller",
  openaiVoice: "coral",
  openaiModel: DEFAULT_TTS_MODEL,
  checkIns: "off",
};
export const getVoiceSettings = (): VoiceSettings => ({ ...DEFAULT_VOICE, ...readJson<Partial<VoiceSettings>>("reader:voice", {}) });
export const setVoiceSettings = (v: VoiceSettings) => writeJson("reader:voice", v);

export interface AiSettings {
  provider: string;
  model: string;
}
export const getAiSettings = () => readJson<AiSettings | null>("reader:ai", null);
export const setAiSettings = (v: AiSettings) => writeJson("reader:ai", v);
