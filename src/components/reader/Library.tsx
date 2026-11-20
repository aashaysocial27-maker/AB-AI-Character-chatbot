"use client";

import { useRef, useState } from "react";
import { BookOpen, FileText, LoaderCircle, Upload, X } from "lucide-react";
import type { BookSummary } from "@/lib/reader/types";

/** Home screen of the reader: drop a PDF, or pick a book read before. */
export function Library({
  books,
  busy,
  progress,
  error,
  onFile,
  onOpen,
  onDelete,
}: {
  books: BookSummary[];
  busy: boolean;
  progress: { done: number; total: number } | null;
  error: string | null;
  onFile: (file: File) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const take = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-16">
      <div className="text-center">
        <p className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 text-xs text-muted">
          <BookOpen className="size-3.5" strokeWidth={1.75} aria-hidden />
          Book Reader
        </p>
        <h1 className="mt-4 font-serif text-3xl tracking-tight sm:text-4xl">Turn any PDF into a book that reads to you</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted">
          Add a PDF and it becomes a chaptered book. Press play to hear it in a natural voice, pause and pick up at the
          same word, ask questions about what you are reading, and collect new words as you go.
        </p>
      </div>

      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          take(e.dataTransfer.files);
        }}
        disabled={busy}
        className={`mt-8 flex w-full flex-col items-center gap-3 rounded-3xl border-2 border-dashed px-6 py-12 transition-colors ${
          dragging ? "border-ink bg-white" : "border-black/10 bg-white/70 hover:border-black/25 hover:bg-white"
        }`}
      >
        {busy ? (
          <>
            <LoaderCircle className="size-8 animate-spin text-muted" strokeWidth={1.5} aria-hidden />
            <span className="text-sm font-medium">Turning your PDF into a book…</span>
            {progress && (
              <span className="w-56">
                <span className="block h-1.5 overflow-hidden rounded-full bg-line">
                  <span
                    className="block h-full rounded-full bg-ink transition-[width]"
                    style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                  />
                </span>
                <span className="mt-1.5 block text-xs text-muted">
                  Page {progress.done} of {progress.total}
                </span>
              </span>
            )}
          </>
        ) : (
          <>
            <span className="grid size-12 place-items-center rounded-full bg-ink text-white">
              <Upload className="size-5" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="text-sm font-medium">Drop a PDF here, or click to choose one</span>
            <span className="text-xs text-muted">It stays in this browser. Nothing is uploaded.</span>
          </>
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          take(e.target.files);
          e.target.value = "";
        }}
      />
      {error && (
        <p role="alert" className="mt-4 rounded-2xl border border-[#f1c9b0] bg-[#fdf1e9] px-4 py-3 text-sm text-[#8a3d12]">
          {error}
        </p>
      )}

      {books.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold tracking-tight">Your books</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {books.map((b) => (
              <li key={b.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onOpen(b.id)}
                  className="flex w-full items-start gap-3 rounded-2xl border border-black/[0.05] bg-white p-4 text-left shadow-card transition-transform hover:-translate-y-0.5"
                >
                  <span className="grid h-14 w-11 shrink-0 place-items-center rounded-md bg-gradient-to-br from-[#2f3b52] to-[#16161a] text-white shadow">
                    <FileText className="size-4" strokeWidth={1.75} aria-hidden />
                  </span>
                  <span className="min-w-0 pr-6">
                    <span className="line-clamp-2 font-serif text-base leading-snug">{b.title}</span>
                    {b.author && <span className="mt-0.5 block truncate text-xs text-muted">{b.author}</span>}
                    <span className="mt-1 block text-xs text-muted">
                      {b.chapterCount} chapters · {b.pageCount} pages
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Remove “${b.title}” from this browser?`)) onDelete(b.id);
                  }}
                  aria-label={`Remove ${b.title}`}
                  className="absolute right-2 top-2 grid size-7 place-items-center rounded-full text-muted opacity-60 hover:bg-page hover:text-ink hover:opacity-100"
                >
                  <X className="size-4" strokeWidth={1.75} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
