"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { openPdf, type PdfDocument } from "@/lib/reader/pdfjs";
import type { PageRect } from "@/lib/reader/positions";

type Viewport = ReturnType<Awaited<ReturnType<PdfDocument["getPage"]>>["getViewport"]>;

/**
 * The original PDF page, exactly as printed. The sentence being read (and the
 * word, where the voice reports words) is marked on the page itself, and a tap
 * on a line starts reading from there.
 */
export function PageView({
  file,
  page,
  pageCount,
  onPage,
  sentence = [],
  word = [],
  onPoint,
  pageRead = false,
}: {
  file: Blob;
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
  /** Boxes of the sentence being read (any page; only this page's are drawn). */
  sentence?: PageRect[];
  word?: PageRect[];
  /** A tap on the page, in PDF coordinates (0-based page index). */
  onPoint?: (pageIndex: number, x: number, y: number) => void;
  /** This page has been listened to. */
  pageRead?: boolean;
}) {
  const [doc, setDoc] = useState<PdfDocument | null>(null);
  const [viewport, setViewport] = useState<{ page: number; vp: Viewport } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    let cancelled = false;
    let close: (() => void) | null = null;
    file
      .arrayBuffer()
      .then(openPdf)
      .then((opened) => {
        close = opened.close;
        if (cancelled) opened.close();
        else setDoc(opened.doc);
      })
      .catch(() => !cancelled && setError("Could not open the original PDF."));
    return () => {
      cancelled = true;
      close?.();
    };
  }, [file]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoxSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!doc || !canvas.current || !boxSize.w) return;
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    setRendering(true);
    (async () => {
      const p = await doc.getPage(Math.min(Math.max(1, page), doc.numPages));
      if (cancelled) return;
      const base = p.getViewport({ scale: 1 });
      const scale = Math.min(boxSize.w / base.width, boxSize.h / base.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const viewport = p.getViewport({ scale: scale * dpr });
      const c = canvas.current!;
      c.width = Math.floor(viewport.width);
      c.height = Math.floor(viewport.height);
      c.style.width = `${Math.floor(viewport.width / dpr)}px`;
      c.style.height = `${Math.floor(viewport.height / dpr)}px`;
      task = p.render({ canvas: c, viewport });
      await task.promise;
      if (!cancelled) setViewport({ page, vp: p.getViewport({ scale }) });
    })()
      .catch(() => {
        // Cancelled by a newer render.
      })
      .finally(() => !cancelled && setRendering(false));
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, page, boxSize]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={box} className="relative grid min-h-0 flex-1 place-items-center">
        {error ? (
          <p className="text-sm text-muted">{error}</p>
        ) : (
          <div className="relative">
            <canvas
              ref={canvas}
              className={`block rounded-md bg-white shadow-card ${onPoint ? "cursor-pointer" : ""}`}
              aria-label={`Page ${page} of the original PDF`}
              onClick={(e) => {
                if (!onPoint || !viewport || viewport.page !== page) return;
                const r = e.currentTarget.getBoundingClientRect();
                const [x, y] = viewport.vp.convertToPdfPoint(e.clientX - r.left, e.clientY - r.top);
                onPoint(page - 1, x, y);
              }}
            />
            {viewport?.page === page && (
              <>
                <Marks rects={sentence} page={page} vp={viewport.vp} className="bg-[#f5c542]/35 mix-blend-multiply transition-all duration-150" pad={0.12} />
                <Marks rects={word} page={page} vp={viewport.vp} className="bg-[#f2a33a]/55 mix-blend-multiply" pad={0.04} />
              </>
            )}
          </div>
        )}
        {(rendering || !doc) && !error && (
          <LoaderCircle className="absolute size-6 animate-spin text-muted" strokeWidth={1.5} aria-hidden />
        )}
      </div>
      <div className="flex items-center justify-between gap-3 px-1 pt-2.5 text-xs text-muted">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 hover:bg-white hover:text-ink disabled:opacity-40"
        >
          <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden />
          Previous
        </button>
        <span className="tabular-nums">
          PDF page {page} of {pageCount}
          {pageRead && <span className="ml-1.5 rounded-full bg-[#e3f4ea] px-1.5 py-0.5 text-[10.5px] font-medium text-[#1f6b47]">✓ read</span>}
        </span>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 hover:bg-white hover:text-ink disabled:opacity-40"
        >
          Next
          <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </div>
  );
}

/** Highlight boxes drawn over the canvas. */
function Marks({ rects, page, vp, className, pad }: { rects: PageRect[]; page: number; vp: Viewport; className: string; pad: number }) {
  return (
    <>
      {rects
        .filter((r) => r.page === page - 1)
        .map((r, i) => {
          const [ax, ay] = vp.convertToViewportPoint(r.x0 - r.h * pad, r.base - r.h * 0.3) as number[];
          const [bx, by] = vp.convertToViewportPoint(r.x1 + r.h * pad, r.base + r.h * 0.92) as number[];
          return (
            <span
              key={i}
              aria-hidden
              className={`pointer-events-none absolute rounded-[3px] ${className}`}
              style={{ left: Math.min(ax, bx), top: Math.min(ay, by), width: Math.abs(bx - ax), height: Math.abs(by - ay) }}
            />
          );
        })}
    </>
  );
}
