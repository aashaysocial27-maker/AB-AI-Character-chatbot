"use client";

import { useState } from "react";
import { Bookmark, Check, ListTree, RotateCcw, Volume2, X } from "lucide-react";
import { pageRanges, type Bookmark as BookmarkItem, type ProgressStats } from "@/lib/reader/progress";
import type { Chapter } from "@/lib/reader/types";

/** Chapter list with per-chapter progress, the book's overall progress, and bookmarks. */
export function ChapterPanel({
  chapters,
  current,
  playing,
  stats,
  pageCount,
  sourceNote,
  bookmarks,
  onOpen,
  onMark,
  onReset,
  onBookmark,
  onDeleteBookmark,
  onClose,
}: {
  chapters: Chapter[];
  current: number;
  playing: boolean;
  stats: ProgressStats;
  pageCount: number;
  sourceNote: string;
  bookmarks: BookmarkItem[];
  onOpen: (chapter: number) => void;
  onMark: (chapter: number, read: boolean) => void;
  onReset: () => void;
  onBookmark: (b: BookmarkItem) => void;
  onDeleteBookmark: (id: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"chapters" | "bookmarks">("chapters");
  const pct = Math.round(stats.percent);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line px-4 pb-3 pt-3">
        <div className="flex items-center justify-between">
          <div className="grid grid-cols-2 rounded-full border border-line bg-page/60 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setTab("chapters")}
              aria-pressed={tab === "chapters"}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${tab === "chapters" ? "bg-ink text-white" : "text-muted"}`}
            >
              <ListTree className="size-3.5" strokeWidth={1.75} aria-hidden /> Chapters
            </button>
            <button
              type="button"
              onClick={() => setTab("bookmarks")}
              aria-pressed={tab === "bookmarks"}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${tab === "bookmarks" ? "bg-ink text-white" : "text-muted"}`}
            >
              <Bookmark className="size-3.5" strokeWidth={1.75} aria-hidden /> Bookmarks
              {bookmarks.length > 0 && <span className="tabular-nums">{bookmarks.length}</span>}
            </button>
          </div>
          <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-full text-muted hover:bg-page lg:hidden" aria-label="Close">
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Whole-book progress */}
        <div className="mt-3">
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-medium">{pct}% of the book read</span>
            <span className="tabular-nums text-muted">
              {stats.chaptersDone}/{chapters.length} chapters
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-[#2e9e6a] transition-[width]" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-[11px] text-muted">
            {stats.pagesRead.size} of {pageCount} pages read
            {stats.pagesRead.size > 0 && <span> · pages {pageRanges(stats.pagesRead)}</span>}
          </p>
        </div>
      </div>

      {tab === "chapters" ? (
        <ol className="min-h-0 flex-1 overflow-y-auto p-2">
          {chapters.map((c, i) => {
            const p = Math.round(stats.chapterPercent[i] ?? 0);
            const done = stats.chapterDone[i];
            const active = i === current;
            return (
              <li key={c.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onOpen(i)}
                  aria-current={active ? "true" : undefined}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors ${
                    active ? "bg-ink text-white" : "text-ink/85 hover:bg-page"
                  }`}
                >
                  <ProgressRing percent={p} done={done} active={active} />
                  <span className="min-w-0 flex-1">
                    <span className="block leading-snug">{c.title}</span>
                    <span className={`block text-[11px] ${active ? "text-white/65" : "text-muted"}`}>
                      {done ? "Completed" : p > 0 ? `${p}% read` : "Not started"} · p. {c.startPage}
                      {c.endPage > c.startPage ? `–${c.endPage}` : ""}
                    </span>
                  </span>
                  {active && playing && <Volume2 className="size-3.5 shrink-0" strokeWidth={1.75} aria-label="reading" />}
                </button>
                <button
                  type="button"
                  onClick={() => onMark(i, !done)}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-full border px-2 py-0.5 text-[10.5px] opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100 ${
                    active ? "border-white/30 bg-ink text-white" : "border-line bg-white text-muted hover:text-ink"
                  } ${active && playing ? "hidden" : ""}`}
                >
                  {done ? "Mark unread" : "Mark as read"}
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {bookmarks.length === 0 ? (
            <p className="rounded-2xl bg-page/70 p-3.5 text-xs leading-relaxed text-muted">
              Press the <Bookmark className="inline size-3.5 align-[-2px]" strokeWidth={1.75} aria-label="bookmark" /> button in the
              player to stop and mark your place. Tap a bookmark to continue from there.
            </p>
          ) : (
            <ul className="space-y-2">
              {[...bookmarks]
                .sort((a, b) => b.createdAt - a.createdAt)
                .map((b) => (
                  <li key={b.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => onBookmark(b)}
                      className="w-full rounded-2xl border border-line bg-white p-3 pr-8 text-left hover:border-black/20"
                    >
                      <span className="block text-[11px] font-medium text-ink/80">
                        {chapters[b.chapter]?.title ?? `Chapter ${b.chapter + 1}`} · page {b.page}
                      </span>
                      <span className="mt-1 line-clamp-2 block font-serif text-[13px] italic text-muted">“{b.snippet}”</span>
                      <span className="mt-1 block text-[10.5px] text-muted">{new Date(b.createdAt).toLocaleString()}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteBookmark(b.id)}
                      className="absolute right-2 top-2 grid size-6 place-items-center rounded-full text-muted hover:bg-page hover:text-ink"
                      aria-label="Delete bookmark"
                    >
                      <X className="size-3.5" strokeWidth={1.75} />
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-2.5">
        <p className="text-[11px] leading-relaxed text-muted">{sourceNote}</p>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Reset reading progress for this book? Bookmarks are kept.")) onReset();
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] text-muted hover:bg-page hover:text-ink"
        >
          <RotateCcw className="size-3" strokeWidth={1.75} aria-hidden /> Reset
        </button>
      </div>
    </div>
  );
}

function ProgressRing({ percent, done, active }: { percent: number; done: boolean; active: boolean }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  const track = active ? "rgb(255 255 255 / 0.2)" : "var(--color-line)";
  const fill = active ? "#ffffff" : "#2e9e6a";
  return (
    <span className="relative grid size-6 shrink-0 place-items-center" aria-label={done ? "Completed" : `${percent}% read`}>
      <svg viewBox="0 0 24 24" className="absolute inset-0 -rotate-90">
        <circle cx="12" cy="12" r={r} fill="none" stroke={track} strokeWidth="2.5" />
        {percent > 0 && (
          <circle cx="12" cy="12" r={r} fill="none" stroke={fill} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={`${(Math.min(100, percent) / 100) * c} ${c}`} />
        )}
      </svg>
      {done && <Check className={`size-3 ${active ? "text-white" : "text-[#2e9e6a]"}`} strokeWidth={3} />}
    </span>
  );
}
