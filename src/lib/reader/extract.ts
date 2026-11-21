"use client";

import { buildBook, type ChapterStart, type Line, type PageLines } from "./layout";
import { openPdf, type PdfDocument } from "./pdfjs";
import type { ParsedBook } from "./types";

interface RawItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName?: string;
}

let measureCtx: CanvasRenderingContext2D | null | undefined;

/**
 * Where each word of a text run starts, as flat [char offset, x] pairs.
 * Word widths come from the canvas with the PDF's font family; any extra width
 * (justified text) is spread across the spaces, as typesetting does.
 */
function wordAnchors(str: string, x: number, width: number, size: number, family: string): number[] {
  if (!/\S\s+\S/.test(str)) return [];
  if (measureCtx === undefined) {
    try {
      measureCtx = document.createElement("canvas").getContext("2d");
    } catch {
      measureCtx = null;
    }
  }
  const ctx = measureCtx;
  if (!ctx) return [];
  ctx.font = `100px ${family}`;
  const natural = ctx.measureText(str).width;
  if (natural <= 0) return [];
  const spaces = (str.match(/ /g) ?? []).length;
  let scale = size / 100;
  let extra = spaces ? (width - natural * scale) / spaces : 0;
  // Font metrics too far off (condensed font, odd size): just stretch evenly.
  if (extra < -size * 0.15 || extra > size * 1.5) {
    scale = width / natural;
    extra = 0;
  }
  const out: number[] = [];
  let spacesBefore = 0;
  for (let i = 1; i < str.length; i++) {
    if (str[i - 1] === " ") spacesBefore++;
    if (str[i] !== " " && str[i - 1] === " ") {
      const wx = x + ctx.measureText(str.slice(0, i)).width * scale + spacesBefore * extra;
      out.push(i, Math.min(x + width, Math.max(x, wx)));
    }
  }
  return out;
}

/** Groups pdf.js text items into lines ordered top to bottom, left to right. */
function toLines(items: RawItem[], pageTop: number, styles: Record<string, { fontFamily?: string }> = {}): Line[] {
  const pieces = items
    .filter((it) => it.str && Math.abs(it.transform[1]) < 0.01 && Math.abs(it.transform[2]) < 0.01)
    .map((it) => {
      const h = Math.abs(it.transform[3]) || it.height || 10;
      return {
        str: it.str,
        x: it.transform[4],
        xEnd: it.transform[4] + it.width,
        y: pageTop - it.transform[5],
        base: it.transform[5],
        h,
        family: (it.fontName && styles[it.fontName]?.fontFamily) || "serif",
      };
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const lines: Line[] = [];
  let group: typeof pieces = [];
  const flush = () => {
    if (group.length === 0) return;
    group.sort((a, b) => a.x - b.x);
    // Build the line's text with single spaces, noting where each text run
    // starts (char offset → x) so a word can later be found on the page.
    let text = "";
    let lastEnd = -Infinity;
    const anchors: number[] = [];
    for (const p of group) {
      let str = p.str.replace(/\s+/g, " ");
      if (!text || text.endsWith(" ")) str = str.replace(/^ /, "");
      if (!str) continue;
      const gap = p.x - lastEnd;
      if (text && gap > p.h * 0.15 && !text.endsWith(" ") && !str.startsWith(" ")) text += " ";
      const at = text.length;
      anchors.push(at, p.x);
      const words = wordAnchors(str, p.x, p.xEnd - p.x, p.h, p.family);
      for (let i = 0; i < words.length; i += 2) anchors.push(at + words[i], words[i + 1]);
      text += str;
      anchors.push(text.length, p.xEnd);
      lastEnd = p.xEnd;
    }
    text = text.trimEnd();
    if (text) {
      lines.push({
        text,
        x: group[0].x,
        xEnd: Math.max(...group.map((p) => p.xEnd)),
        y: median(group.map((p) => p.y)),
        base: median(group.map((p) => p.base)),
        h: Math.max(...group.map((p) => p.h)),
        anchors,
      });
    }
    group = [];
  };

  for (const piece of pieces) {
    const anchor = group[0];
    if (anchor && Math.abs(piece.y - anchor.y) > Math.min(piece.h, anchor.h) * 0.5) flush();
    group.push(piece);
  }
  flush();
  return lines;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

type OutlineNode = Awaited<ReturnType<PdfDocument["getOutline"]>>[number];

/** Reads chapter starts from the PDF's bookmarks, if it has any. */
async function readOutline(doc: PdfDocument): Promise<ChapterStart[]> {
  let outline: OutlineNode[] | null = null;
  try {
    outline = await doc.getOutline();
  } catch {
    return [];
  }
  if (!outline || outline.length === 0) return [];
  // A single top-level entry is usually the book title; use its children.
  let nodes = outline;
  while (nodes.length === 1 && nodes[0].items?.length) nodes = nodes[0].items;

  const starts: ChapterStart[] = [];
  for (const node of nodes) {
    const page = await resolvePage(doc, node.dest);
    if (page === null) continue;
    const title = node.title.replace(/\s+/g, " ").trim() || `Section ${starts.length + 1}`;
    starts.push({ title, page, line: 0 });
  }
  // Several bookmarks on one page: keep the first.
  const byPage = new Map<number, ChapterStart>();
  for (const s of starts) if (!byPage.has(s.page)) byPage.set(s.page, s);
  return [...byPage.values()].sort((a, b) => a.page - b.page);
}

async function resolvePage(doc: PdfDocument, dest: OutlineNode["dest"]): Promise<number | null> {
  try {
    const explicit = typeof dest === "string" ? await doc.getDestination(dest) : dest;
    if (!Array.isArray(explicit) || explicit.length === 0) return null;
    const target = explicit[0];
    if (typeof target === "number") return target;
    if (target && typeof target === "object") return await doc.getPageIndex(target as never);
  } catch {
    // Broken bookmark: skip it.
  }
  return null;
}

async function hashFile(buffer: ArrayBuffer): Promise<string> {
  try {
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return `b${buffer.byteLength}-${Date.now()}`;
  }
}

/** Reads a PDF file into a chaptered, reflowed book. Runs entirely in the browser. */
export async function parsePdf(file: File, onProgress?: (done: number, total: number) => void): Promise<ParsedBook> {
  const buffer = await file.arrayBuffer();
  const [id, { doc, close }] = await Promise.all([hashFile(buffer), openPdf(buffer)]);

  try {
    const pages: PageLines[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const [x0, y0, x1, y1] = page.view;
      const content = await page.getTextContent();
      pages.push({
        index: i - 1,
        width: x1 - x0,
        height: y1 - y0,
        lines: toLines(content.items as RawItem[], y1, content.styles as Record<string, { fontFamily?: string }>),
      });
      page.cleanup();
      onProgress?.(i, doc.numPages);
    }

    const outline = await readOutline(doc);
    let title = file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
    let author: string | undefined;
    try {
      const meta = await doc.getMetadata();
      const info = meta.info as { Title?: string; Author?: string };
      if (info.Title?.trim() && !/^untitled|\.(docx?|pdf|indd)$/i.test(info.Title.trim())) title = info.Title.trim();
      if (info.Author?.trim()) author = info.Author.trim();
    } catch {
      // No metadata: keep the file name.
    }

    return buildBook(pages, outline, { id, title, author });
  } finally {
    close();
  }
}
