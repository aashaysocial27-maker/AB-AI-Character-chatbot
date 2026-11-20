"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { openPdf, type PdfDocument } from "@/lib/reader/pdfjs";

/** The original PDF page, exactly as printed, for books with pictures or tricky layouts. */
export function PageView({ file, page, pageCount, onPage }: { file: Blob; page: number; pageCount: number; onPage: (p: number) => void }) {
  const [doc, setDoc] = useState<PdfDocument | null>(null);
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
          <canvas ref={canvas} className="rounded-md bg-white shadow-card" aria-label={`Page ${page} of the original PDF`} />
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
