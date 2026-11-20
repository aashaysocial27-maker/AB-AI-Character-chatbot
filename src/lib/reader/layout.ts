/**
 * Turns positioned PDF text lines into a book: running headers and page
 * numbers removed, hyphenated words rejoined, lines reflowed into paragraphs,
 * and the whole thing split into chapters.
 *
 * Pure functions with no pdf.js dependency, so they are easy to test.
 */

import type { Chapter, ParsedBook } from "./types";

export interface Line {
  text: string;
  /** Left edge, in PDF units. */
  x: number;
  /** Right edge. */
  xEnd: number;
  /** Baseline, measured from the top of the page (grows downward). */
  y: number;
  /** Font size (text height). */
  h: number;
}

export interface PageLines {
  width: number;
  height: number;
  lines: Line[];
}

/** A chapter start found from the PDF outline or from headings. */
export interface ChapterStart {
  title: string;
  /** 0-based page index. */
  page: number;
  /** Line index on that page where the chapter begins (0 for outline entries). */
  line: number;
}

const HEADING_WORD =
  /^(chapter|chap\.|part|book|section|prologue|epilogue|introduction|preface|foreword|afterword|appendix|conclusion|contents|acknowledg(e)?ments|interlude)\b/i;
const NUMBER_WORD =
  /^(chapter|part|book|section)\s+([0-9]+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty[\w-]*|thirty[\w-]*|forty[\w-]*|fifty[\w-]*)\b/i;
const PAGE_NUMBER = /^[\s\-–—]*(\d{1,4}|[ivxlcdm]{1,7})[\s\-–—]*$/i;
const TERMINAL = /[.!?:;…"”’)\]]$/;

function median(values: number[], fallback: number): number {
  if (values.length === 0) return fallback;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function percentile(values: number[], p: number, fallback: number): number {
  if (values.length === 0) return fallback;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

const normalizeRepeat = (text: string) => text.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();

/** Removes page numbers and running headers/footers that repeat across pages. */
export function stripFurniture(pages: PageLines[]): PageLines[] {
  const counts = new Map<string, number>();
  for (const page of pages) {
    const seen = new Set<string>();
    for (const line of page.lines) {
      if (!isEdge(line, page)) continue;
      const key = normalizeRepeat(line.text);
      if (key && !seen.has(key)) {
        seen.add(key);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  const minRepeats = Math.max(3, Math.ceil(pages.length * 0.15));

  return pages.map((page) => ({
    ...page,
    lines: page.lines.filter((line) => {
      if (!isEdge(line, page)) return true;
      if (PAGE_NUMBER.test(line.text)) return false;
      return (counts.get(normalizeRepeat(line.text)) ?? 0) < minRepeats;
    }),
  }));
}

function isEdge(line: Line, page: PageLines): boolean {
  return line.y < page.height * 0.09 || line.y > page.height * 0.91;
}

interface Metrics {
  bodyH: number;
  lineGap: number;
}

function measure(pages: PageLines[]): Metrics {
  const heights: number[] = [];
  const gaps: number[] = [];
  for (const page of pages) {
    for (let i = 0; i < page.lines.length; i++) {
      const line = page.lines[i];
      if (line.text.length > 20) heights.push(line.h);
      const prev = page.lines[i - 1];
      if (prev) {
        const gap = line.y - prev.y;
        if (gap > 0) gaps.push(gap);
      }
    }
  }
  const bodyH = median(heights, 11);
  return { bodyH, lineGap: Math.min(median(gaps, bodyH * 1.3), bodyH * 2.2) };
}

/** Finds chapter headings by wording ("Chapter 3", "Prologue") or by a much larger font. */
export function findHeadings(pages: PageLines[]): ChapterStart[] {
  const { bodyH } = measure(pages);

  const collect = (allowBigOnly: boolean): ChapterStart[] => {
    const found: ChapterStart[] = [];
    pages.forEach((page, pageIndex) => {
      for (let i = 0; i < page.lines.length; i++) {
        const line = page.lines[i];
        const text = line.text.trim();
        if (text.length < 2 || text.length > 80 || !/[A-Za-z]/.test(text)) continue;
        // Table of contents lines ("Chapter 1 ........ 12") are not headings.
        if (/\.{4,}|\s\d{1,4}$/.test(text) && !NUMBER_WORD.test(text.replace(/\s\d{1,4}$/, ""))) continue;
        const big = line.h >= bodyH * 1.35;
        const nearTop = i < 4 || line.y < page.height * 0.4;
        // Headings start with a capital or digit and don't run on like a sentence ("chapter one, and the…").
        const headingShaped = /^[\p{Lu}\d]/u.test(text) && !/[,;]$/.test(text) && (big || text.length <= 40);
        const worded =
          headingShaped && (NUMBER_WORD.test(text) || (HEADING_WORD.test(text) && (big || text.split(/\s+/).length <= 4)));
        if (!(nearTop && (worded || (allowBigOnly && big)))) continue;

        // A heading is often two lines: "CHAPTER ONE" then the chapter name.
        let title = text;
        const next = page.lines[i + 1];
        if (next && next.h >= bodyH * 1.2 && next.text.length <= 80 && (worded || big)) {
          title = `${text}: ${next.text.trim()}`;
          i++;
        }
        found.push({ title: tidyTitle(title), page: pageIndex, line: i - (title === text ? 0 : 1) });
        break; // at most one chapter start per page
      }
    });
    return found;
  };

  const worded = collect(false);
  if (worded.length >= 2) return dedupeToc(worded);
  const withBig = collect(true);
  // Large text on most pages means it is not marking chapters.
  if (withBig.length >= 2 && withBig.length <= Math.max(3, pages.length * 0.5)) return dedupeToc(withBig);
  return [];
}

/** If the same titles appear first in a table of contents, keep the later (real) ones. */
function dedupeToc(starts: ChapterStart[]): ChapterStart[] {
  const lastByTitle = new Map<string, ChapterStart>();
  for (const s of starts) lastByTitle.set(s.title.toLowerCase(), s);
  return starts.filter((s) => lastByTitle.get(s.title.toLowerCase()) === s);
}

function tidyTitle(title: string): string {
  const t = title.replace(/\s+/g, " ").trim();
  // "CHAPTER ONE" reads better as "Chapter One".
  if (t === t.toUpperCase() && /[A-Z]{3}/.test(t)) {
    return t.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());
  }
  return t;
}

/** Reflows the lines of a page range into paragraphs. */
export function reflow(pages: PageLines[], metrics: Metrics): string[] {
  const { bodyH, lineGap } = metrics;
  const paragraphs: string[] = [];
  let current = "";
  let prevLine: Line | null = null;
  let prevRight = 0;

  const flush = () => {
    const text = current.replace(/\s+/g, " ").trim();
    if (text) paragraphs.push(text);
    current = "";
  };

  for (const page of pages) {
    if (page.lines.length === 0) continue;
    const left = percentile(page.lines.map((l) => l.x), 0.1, 0);
    const right = percentile(page.lines.map((l) => l.xEnd), 0.9, page.width);
    let first = true;

    for (const line of page.lines) {
      const text = line.text.trim();
      if (!text) continue;
      const indented = line.x > left + bodyH * 0.9 && line.x < left + bodyH * 6;
      const centered = Math.abs((line.x + line.xEnd) / 2 - (left + right) / 2) < bodyH && line.xEnd - line.x < (right - left) * 0.6;
      const headingSize = line.h >= bodyH * 1.25;

      let breakHere = false;
      if (prevLine) {
        const prevText = current.trimEnd();
        const prevEndedSentence = TERMINAL.test(prevText);
        const prevShort = prevLine.xEnd < prevRight - bodyH * 2.5;
        if (first) {
          // Page turn: carry on unless the previous paragraph clearly ended.
          breakHere = prevEndedSentence && (indented || prevShort);
        } else {
          const gap = line.y - prevLine.y;
          breakHere =
            gap > lineGap * 1.45 ||
            (indented && prevEndedSentence) ||
            (prevShort && prevEndedSentence) ||
            headingSize !== (prevLine.h >= bodyH * 1.25) ||
            centered;
        }
      }

      if (breakHere) flush();
      if (current.endsWith("-") && /^[a-z]/.test(text) && !/\s-$/.test(current)) {
        current = current.slice(0, -1) + text; // re-join a hyphenated word
      } else {
        current = current ? `${current} ${text}` : text;
      }
      if (centered && !headingSize) flush();
      prevLine = line;
      prevRight = right;
      first = false;
    }
  }
  flush();
  return paragraphs;
}

const plain = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** The chapter title is shown as a heading, so drop its copy at the top of the text. */
function dropTitleLines(paragraphs: string[], title: string): string[] {
  const t = plain(title);
  if (!t) return paragraphs;
  let k = 0;
  while (k < Math.min(3, paragraphs.length)) {
    const p = plain(paragraphs[k]);
    if (!p || p.length > t.length + 2 || !t.includes(p)) break;
    k++;
  }
  return paragraphs.slice(k);
}

/** Builds the chapters of the book from cleaned pages and optional outline entries. */
export function buildBook(
  rawPages: PageLines[],
  outline: ChapterStart[],
  meta: { id: string; title: string; author?: string },
): ParsedBook {
  const pages = stripFurniture(rawPages);
  const metrics = measure(pages);
  const totalChars = pages.reduce((n, p) => n + p.lines.reduce((m, l) => m + l.text.length, 0), 0);
  const looksScanned = totalChars < Math.max(200, pages.length * 40);

  let starts = outline;
  let chapterSource: ParsedBook["chapterSource"] = "outline";
  if (starts.length < 2) {
    starts = findHeadings(pages);
    chapterSource = "headings";
  }
  if (starts.length < 2) {
    chapterSource = "pages";
    const size = pages.length <= 30 ? 5 : 10;
    starts = [];
    for (let p = 0; p < pages.length; p += size) {
      const end = Math.min(pages.length, p + size);
      starts.push({ title: end - p === 1 ? `Page ${p + 1}` : `Pages ${p + 1}–${end}`, page: p, line: 0 });
    }
  }
  starts = [...starts].sort((a, b) => a.page - b.page || a.line - b.line);

  const chapters: Chapter[] = [];
  const slice = (from: ChapterStart, to: ChapterStart | null): PageLines[] => {
    const out: PageLines[] = [];
    const lastPage = to ? to.page : pages.length - 1;
    for (let p = from.page; p <= lastPage && p < pages.length; p++) {
      const page = pages[p];
      const startLine = p === from.page ? from.line : 0;
      const endLine = to && p === to.page ? to.line : page.lines.length;
      if (to && p === to.page && to.line === 0 && p !== from.page) break;
      out.push({ ...page, lines: page.lines.slice(startLine, endLine) });
    }
    return out;
  };

  const pushChapter = (title: string, from: ChapterStart, to: ChapterStart | null) => {
    const range = slice(from, to);
    const paragraphs = dropTitleLines(reflow(range, metrics), title);
    if (paragraphs.length === 0) return;
    const endPage = to ? (to.line === 0 ? Math.max(from.page, to.page - 1) : to.page) : pages.length - 1;
    chapters.push({
      id: `c${chapters.length}`,
      title,
      startPage: from.page + 1,
      endPage: endPage + 1,
      paragraphs,
    });
  };

  // Anything before the first chapter (title page, dedication…).
  const first = starts[0];
  if (first.page > 0 || first.line > 0) {
    pushChapter("Opening pages", { title: "", page: 0, line: 0 }, first);
  }
  starts.forEach((start, i) => pushChapter(start.title, start, starts[i + 1] ?? null));

  if (chapters.length === 0) {
    chapters.push({ id: "c0", title: meta.title, startPage: 1, endPage: Math.max(1, pages.length), paragraphs: [] });
  }

  return {
    id: meta.id,
    title: meta.title,
    author: meta.author,
    pageCount: pages.length,
    chapters,
    chapterSource,
    looksScanned,
  };
}

/** Splits a paragraph into speakable units: sentences, with long ones cut at commas or spaces. */
export function splitUnits(paragraph: string, maxChars = 220): string[] {
  const sentences: string[] = [];
  const Segmenter = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (Segmenter) {
    for (const s of new Segmenter("en", { granularity: "sentence" }).segment(paragraph)) {
      if (s.segment.trim()) sentences.push(s.segment);
    }
  } else {
    sentences.push(...(paragraph.match(/[^.!?]+[.!?]+["”’)]*\s*|[^.!?]+$/g) ?? [paragraph]));
  }

  const units: string[] = [];
  for (const sentence of sentences) {
    let rest = sentence;
    while (rest.length > maxChars) {
      const window = rest.slice(0, maxChars);
      let cut = Math.max(window.lastIndexOf(", "), window.lastIndexOf("; "), window.lastIndexOf(": "), window.lastIndexOf(" — "));
      if (cut < maxChars * 0.4) cut = window.lastIndexOf(" ");
      if (cut <= 0) cut = maxChars;
      units.push(rest.slice(0, cut + 1));
      rest = rest.slice(cut + 1);
    }
    if (rest.trim()) units.push(rest);
  }
  // Merge tiny fragments ("Mr." splits, lone quotes) into the previous unit.
  const merged: string[] = [];
  for (const u of units) {
    if (merged.length && u.trim().length < 4) merged[merged.length - 1] += u;
    else merged.push(u);
  }
  return merged;
}
