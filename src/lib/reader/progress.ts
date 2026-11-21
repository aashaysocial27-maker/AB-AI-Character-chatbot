"use client";

import { splitUnits } from "./layout";
import { rectsFor, unitRanges } from "./positions";
import type { ParsedBook } from "./types";

/**
 * Reading progress. Only sentences that were actually listened to the end
 * count as read; skipping ahead does not. A chapter can also be marked read
 * or unread by hand. Everything is stored per book in localStorage.
 */

/** chapter index → string of "0"/"1", one character per sentence. */
export type Heard = Record<number, string>;

export interface Bookmark {
  id: string;
  chapter: number;
  unit: number;
  page: number;
  snippet: string;
  createdAt: number;
}

/** Summary shown on the library card. */
export interface BookSummaryProgress {
  percent: number;
  pagesRead: number;
  pageCount: number;
  chaptersDone: number;
  chapterCount: number;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked
  }
}

export const getHeard = (bookId: string) => read<Heard>(`reader:heard:${bookId}`, {});
export const setHeard = (bookId: string, h: Heard) => write(`reader:heard:${bookId}`, h);
export const getBookmarks = (bookId: string) => read<Bookmark[]>(`reader:bookmarks:${bookId}`, []);
export const setBookmarks = (bookId: string, b: Bookmark[]) => write(`reader:bookmarks:${bookId}`, b);
export const getSummary = (bookId: string) => read<BookSummaryProgress | null>(`reader:summary:${bookId}`, null);
export const setSummary = (bookId: string, s: BookSummaryProgress) => write(`reader:summary:${bookId}`, s);
export function clearProgressStore(bookId: string) {
  try {
    for (const k of ["heard", "bookmarks", "summary"]) window.localStorage.removeItem(`reader:${k}:${bookId}`);
  } catch {
    // ignore
  }
}

/** Marks one sentence as heard. Returns a new object only if something changed. */
export function markHeard(heard: Heard, chapter: number, unit: number, unitCount: number): Heard {
  const row = (heard[chapter] ?? "").padEnd(unitCount, "0");
  if (row[unit] === "1") return heard;
  return { ...heard, [chapter]: row.slice(0, unit) + "1" + row.slice(unit + 1) };
}

/** Per book: each sentence's length and the PDF page it is on. Computed once per book. */
export interface BookLayout {
  chapters: { lengths: number[]; pages: number[]; total: number }[];
  /** Total characters on each page (1-based page → chars). */
  pageChars: Map<number, number>;
}

export function layoutOf(book: ParsedBook): BookLayout {
  const pageChars = new Map<number, number>();
  const chapters = book.chapters.map((c) => {
    const lengths: number[] = [];
    const pages: number[] = [];
    c.paragraphs.forEach((p, pi) => {
      const units = splitUnits(p);
      const ranges = unitRanges(p, units);
      units.forEach((u, k) => {
        lengths.push(u.length);
        const rect = rectsFor(c.spans?.[pi], ranges[k][0], ranges[k][1])[0];
        pages.push(rect ? rect.page + 1 : -1);
      });
    });
    // Without line positions, spread the sentences evenly over the chapter's pages.
    const total = lengths.reduce((a, b) => a + b, 0);
    let acc = 0;
    pages.forEach((pg, k) => {
      if (pg < 0) {
        const span = c.endPage - c.startPage;
        pages[k] = c.startPage + Math.min(span, Math.floor((acc / Math.max(1, total)) * (span + 1)));
      }
      acc += lengths[k];
      pageChars.set(pages[k], (pageChars.get(pages[k]) ?? 0) + lengths[k]);
    });
    return { lengths, pages, total };
  });
  return { chapters, pageChars };
}

export interface ProgressStats {
  /** 0–100 per chapter. */
  chapterPercent: number[];
  chapterDone: boolean[];
  pagesRead: Set<number>;
  percent: number;
  chaptersDone: number;
}

export function statsOf(layout: BookLayout, heard: Heard): ProgressStats {
  const pageHeard = new Map<number, number>();
  let heardAll = 0;
  let totalAll = 0;
  const chapterPercent: number[] = [];
  const chapterDone: boolean[] = [];
  layout.chapters.forEach((c, ci) => {
    const row = heard[ci] ?? "";
    let h = 0;
    c.lengths.forEach((len, k) => {
      if (row[k] === "1") {
        h += len;
        pageHeard.set(c.pages[k], (pageHeard.get(c.pages[k]) ?? 0) + len);
      }
    });
    heardAll += h;
    totalAll += c.total;
    const pct = c.total ? (h / c.total) * 100 : 0;
    chapterPercent.push(pct);
    chapterDone.push(c.total > 0 && pct >= 97);
  });
  const pagesRead = new Set<number>();
  for (const [page, chars] of layout.pageChars) {
    if (chars > 0 && (pageHeard.get(page) ?? 0) / chars >= 0.9) pagesRead.add(page);
  }
  return {
    chapterPercent,
    chapterDone,
    pagesRead,
    percent: totalAll ? (heardAll / totalAll) * 100 : 0,
    chaptersDone: chapterDone.filter(Boolean).length,
  };
}

/** "1–4, 7, 9–10" */
export function pageRanges(pages: Iterable<number>): string {
  const sorted = [...pages].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    out.push(i === j ? `${sorted[i]}` : `${sorted[i]}–${sorted[j]}`);
    i = j;
  }
  return out.join(", ");
}
