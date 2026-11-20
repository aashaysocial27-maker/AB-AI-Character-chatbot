"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Chapter } from "@/lib/reader/types";
import type { WordMark } from "@/lib/reader/useSpeech";

export interface Selection {
  text: string;
  /** Sentence the selection sits in. */
  context: string;
  unit: number;
  x: number;
  y: number;
}

const GAP = 56;

/**
 * The chapter laid out as book pages: two facing pages on wide screens, one on
 * phones. Uses CSS columns, so the browser does the pagination; we just slide
 * the strip one spread at a time and follow the sentence being read.
 */
export function BookView({
  chapter,
  chapterNumber,
  unitsByParagraph,
  current,
  word,
  follow,
  onPick,
  onSelect,
}: {
  chapter: Chapter;
  chapterNumber: number;
  /** For each paragraph, its units' text and global unit index. */
  unitsByParagraph: { text: string; index: number }[][];
  current: number;
  word: WordMark | null;
  /** Turn pages automatically to keep the current sentence in view. */
  follow: boolean;
  onPick: (unit: number) => void;
  onSelect: (sel: Selection | null) => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0, cols: 1 });
  const [spread, setSpread] = useState(0);
  const [spreads, setSpreads] = useState(1);
  const touchX = useRef<number | null>(null);

  // Measure the frame; two columns when there is room for comfortable lines.
  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setSize({ w, h, cols: w >= 860 ? 2 : 1 });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pitch = size.w + GAP;

  // Count spreads after layout.
  useLayoutEffect(() => {
    const el = strip.current;
    if (!el || !size.w) return;
    const count = Math.max(1, Math.round((el.scrollWidth + GAP) / pitch));
    setSpreads(count);
    setSpread((s) => Math.min(s, count - 1));
  }, [size, pitch, chapter, unitsByParagraph]);

  const spreadOf = useCallback(
    (el: HTMLElement) => (pitch > 0 ? Math.max(0, Math.floor((el.offsetLeft + 1) / pitch)) : 0),
    [pitch],
  );

  // Highlight the sentence being read and turn the page to it.
  useEffect(() => {
    const root = strip.current;
    if (!root) return;
    root.querySelectorAll(".is-reading").forEach((n) => n.classList.remove("is-reading"));
    const el = root.querySelector<HTMLElement>(`[data-u="${current}"]`);
    if (!el) return;
    el.classList.add("is-reading");
    if (follow) setSpread(spreadOf(el));
  }, [current, follow, spreadOf, chapter.id, size]);

  // Highlight the word being spoken, where the browser supports CSS highlights.
  useEffect(() => {
    const registry = (globalThis.CSS as unknown as { highlights?: Map<string, unknown> })?.highlights;
    const HighlightCtor = (globalThis as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight;
    if (!registry || !HighlightCtor) return;
    registry.delete("reading-word");
    if (!word) return;
    const el = strip.current?.querySelector<HTMLElement>(`[data-u="${word.unit}"]`);
    const node = el?.firstChild;
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    const len = node.textContent?.length ?? 0;
    if (word.start >= len) return;
    const range = document.createRange();
    range.setStart(node, word.start);
    range.setEnd(node, Math.min(len, word.start + Math.max(1, word.length)));
    registry.set("reading-word", new HighlightCtor(range));
  }, [word]);

  const go = useCallback((delta: number) => setSpread((s) => Math.max(0, Math.min(spreads - 1, s + delta))), [spreads]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") go(1);
      else if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const handlePointerUp = () => {
    // Let the browser finish the selection first.
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel?.toString().replace(/\s+/g, " ").trim() ?? "";
      if (!sel || !text || text.length > 80 || sel.rangeCount === 0) {
        onSelect(null);
        return;
      }
      const anchor = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement;
      const unitEl = anchor?.closest<HTMLElement>("[data-u]");
      if (!unitEl || !strip.current?.contains(unitEl)) return;
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      onSelect({
        text: text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""),
        context: unitEl.textContent?.trim() ?? "",
        unit: Number(unitEl.dataset.u),
        x: rect.left + rect.width / 2,
        y: rect.top,
      });
    }, 10);
  };

  const pageNo = (k: number) => spread * size.cols + k + 1;
  const totalPages = spreads * size.cols;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1">
        {/* The paper */}
        <div className="book-paper absolute inset-0 rounded-[1.25rem] sm:rounded-[1.75rem]">
          {size.cols === 2 && <div className="book-gutter pointer-events-none absolute inset-y-0 left-1/2 w-16 -translate-x-1/2" />}
        </div>
        <div
          ref={frame}
          className="absolute inset-x-5 inset-y-7 overflow-clip sm:inset-x-10 sm:inset-y-10 lg:inset-x-14"
          onPointerUp={handlePointerUp}
          onTouchStart={(e) => {
            touchX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) > 60 && !window.getSelection()?.toString()) go(dx < 0 ? 1 : -1);
          }}
        >
          {size.w > 0 && (
            <div
              ref={strip}
              className="book-text relative transition-transform duration-500 ease-out motion-reduce:transition-none"
              style={{
                width: size.w,
                height: size.h,
                columnCount: size.cols,
                columnGap: GAP,
                columnFill: "auto",
                transform: `translateX(${-spread * pitch}px)`,
              }}
            >
              <ChapterBody
                chapter={chapter}
                chapterNumber={chapterNumber}
                unitsByParagraph={unitsByParagraph}
                onPick={onPick}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-1 pt-2.5 text-xs text-muted">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={spread === 0}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 hover:bg-white hover:text-ink disabled:opacity-40"
        >
          <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden />
          Previous page
        </button>
        <span className="tabular-nums">
          {size.cols === 2 ? `Pages ${pageNo(0)}–${Math.min(pageNo(1), totalPages)}` : `Page ${pageNo(0)}`} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={spread >= spreads - 1}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 hover:bg-white hover:text-ink disabled:opacity-40"
        >
          Next page
          <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </div>
  );
}

/** Static chapter text. Memoised: highlighting is done on the DOM, not by re-rendering. */
const ChapterBody = memo(function ChapterBody({
  chapter,
  chapterNumber,
  unitsByParagraph,
  onPick,
}: {
  chapter: Chapter;
  chapterNumber: number;
  unitsByParagraph: { text: string; index: number }[][];
  onPick: (unit: number) => void;
}) {
  return (
    <>
      <header className="mb-8 break-inside-avoid pt-6 text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-muted">{chapterNumber}</p>
        <h2 className="mt-3 font-serif text-2xl leading-tight sm:text-[1.7rem]">{chapter.title}</h2>
        <div className="mx-auto mt-5 h-px w-12 bg-black/15" />
      </header>
      {unitsByParagraph.length === 0 && (
        <p className="text-center text-sm text-muted">No readable text on these pages. Try the Original view.</p>
      )}
      {unitsByParagraph.map((units, p) => (
        <p key={p} className={p === 0 ? "first-para" : undefined}>
          {units.map((u) => (
            <span
              key={u.index}
              data-u={u.index}
              className="unit"
              onClick={() => {
                if (!window.getSelection()?.toString()) onPick(u.index);
              }}
            >
              {u.text}
            </span>
          ))}
        </p>
      ))}
      <p className="pt-8 text-center font-serif text-lg text-muted">❦</p>
    </>
  );
});
