import type { LineSpan } from "./types";

/** A box on an original PDF page, in PDF units. */
export interface PageRect {
  /** 0-based page index. */
  page: number;
  x0: number;
  x1: number;
  /** Baseline, PDF units from the bottom of the page. */
  base: number;
  /** Font size. */
  h: number;
}

/** Character range of each unit inside its paragraph (units are consecutive slices of it). */
export function unitRanges(paragraph: string, units: string[]): [number, number][] {
  const out: [number, number][] = [];
  let cursor = 0;
  for (const u of units) {
    const found = paragraph.indexOf(u, cursor);
    const start = found >= 0 ? found : cursor;
    out.push([start, start + u.length]);
    cursor = start + u.length;
  }
  return out;
}

/**
 * Boxes on the original pages covering characters [start, end) of a paragraph.
 * Inside a line the position is estimated from the share of characters, which
 * is close enough to mark a sentence or a word.
 */
export function rectsFor(spans: LineSpan[] | undefined, start: number, end: number): PageRect[] {
  if (!spans) return [];
  const rects: PageRect[] = [];
  for (const [page, x, xEnd, base, h, s, e, anchors] of spans) {
    const a = Math.max(start, s);
    const b = Math.min(end, e);
    if (b <= a || e <= s) continue;
    rects.push({ page, x0: xAt(a - s, e - s, x, xEnd, anchors), x1: xAt(b - s, e - s, x, xEnd, anchors), base, h });
  }
  return rects;
}

/**
 * x position of a character offset inside a line. Between the starts of the
 * line's text runs (known exactly from the PDF) it is estimated by character
 * count, which keeps errors within one run instead of across the whole line.
 */
function xAt(offset: number, length: number, x: number, xEnd: number, anchors?: number[]): number {
  const points: number[] = [0, x];
  if (anchors) {
    for (let i = 0; i + 1 < anchors.length; i += 2) {
      const [o, ax] = [anchors[i], anchors[i + 1]];
      if (o > points[points.length - 2] && o < length && ax >= points[points.length - 1]) points.push(o, ax);
    }
  }
  points.push(length, xEnd);
  for (let i = 0; i + 3 < points.length; i += 2) {
    const [o0, x0, o1, x1] = [points[i], points[i + 1], points[i + 2], points[i + 3]];
    if (offset <= o1) return x0 + ((x1 - x0) * (offset - o0)) / Math.max(1, o1 - o0);
  }
  return xEnd;
}

/** The paragraph character offset at a point on a page, or null if no line is there. */
export function offsetAt(
  spansByParagraph: LineSpan[][] | undefined,
  page: number,
  px: number,
  py: number,
): { paragraph: number; offset: number } | null {
  if (!spansByParagraph) return null;
  let best: { paragraph: number; offset: number } | null = null;
  let bestDist = Infinity;
  for (let paragraph = 0; paragraph < spansByParagraph.length; paragraph++) {
    for (const [pg, x, xEnd, base, h, s, e] of spansByParagraph[paragraph]) {
      if (pg !== page) continue;
      const top = base + h * 0.95;
      const bottom = base - h * 0.35;
      const dy = py > top ? py - top : py < bottom ? bottom - py : 0;
      const dx = px < x ? x - px : px > xEnd ? px - xEnd : 0;
      const dist = dy * 4 + dx;
      if (dist > h * 3 || dist >= bestDist) continue;
      const f = Math.min(1, Math.max(0, (px - x) / Math.max(1, xEnd - x)));
      best = { paragraph, offset: s + Math.round(f * (e - s)) };
      bestDist = dist;
    }
  }
  return best;
}
