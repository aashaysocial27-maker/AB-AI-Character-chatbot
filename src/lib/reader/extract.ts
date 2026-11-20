"use client";

import { buildBook, type ChapterStart, type Line, type PageLines } from "./layout";
import { openPdf, type PdfDocument } from "./pdfjs";
import type { ParsedBook } from "./types";

interface RawItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

/** Groups pdf.js text items into lines ordered top to bottom, left to right. */
function toLines(items: RawItem[], pageTop: number): Line[] {
  const pieces = items
    .filter((it) => it.str && Math.abs(it.transform[1]) < 0.01 && Math.abs(it.transform[2]) < 0.01)
    .map((it) => {
      const h = Math.abs(it.transform[3]) || it.height || 10;
      return { str: it.str, x: it.transform[4], xEnd: it.transform[4] + it.width, y: pageTop - it.transform[5], h };
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const lines: Line[] = [];
  let group: typeof pieces = [];
  const flush = () => {
    if (group.length === 0) return;
    group.sort((a, b) => a.x - b.x);
    let text = "";
    let lastEnd = -Infinity;
    for (const p of group) {
      const gap = p.x - lastEnd;
      if (text && gap > p.h * 0.15 && !text.endsWith(" ") && !p.str.startsWith(" ")) text += " ";
      text += p.str;
      lastEnd = p.xEnd;
    }
    text = text.replace(/\s+/g, " ").trim();
    if (text) {
      lines.push({
        text,
        x: group[0].x,
        xEnd: Math.max(...group.map((p) => p.xEnd)),
        y: median(group.map((p) => p.y)),
        h: Math.max(...group.map((p) => p.h)),
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
        width: x1 - x0,
        height: y1 - y0,
        lines: toLines(content.items as RawItem[], y1),
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
