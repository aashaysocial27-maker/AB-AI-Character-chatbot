"use client";

import { useMemo, useState } from "react";
import { BookA, Download, Eye, EyeOff, LoaderCircle, Sparkles, Volume2, X } from "lucide-react";
import type { WordEntry } from "@/lib/reader/types";
import { Markdown } from "../Markdown";

/** Words collected while reading, with meanings, the sentence they came from, and a self-test mode. */
export function WordBank({
  words,
  bookId,
  loadingIds,
  onSpeak,
  onExplain,
  onRemove,
  onAdd,
}: {
  words: WordEntry[];
  bookId: string;
  loadingIds: Set<string>;
  onSpeak: (text: string) => void;
  onExplain: (entry: WordEntry) => void;
  onRemove: (id: string) => void;
  onAdd: (word: string) => void;
}) {
  const [scope, setScope] = useState<"book" | "all">("book");
  const [query, setQuery] = useState("");
  const [practice, setPractice] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [newWord, setNewWord] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return words
      .filter((w) => scope === "all" || w.bookId === bookId)
      .filter((w) => !q || w.word.toLowerCase().includes(q))
      .sort((a, b) => b.addedAt - a.addedAt);
  }, [words, scope, bookId, query]);

  const exportCsv = () => {
    const esc = (s = "") => `"${s.replace(/"/g, '""').replace(/\n/g, " ")}"`;
    const rows = [
      ["Word", "Phonetic", "Definition", "Meaning in context", "Sentence", "Book", "Chapter"].map((h) => esc(h)).join(","),
      ...shown.map((w) =>
        [w.word, w.phonetic, w.definition, w.aiNote, w.context, w.bookTitle, w.chapterTitle].map(esc).join(","),
      ),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "word-bank.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <BookA className="size-4" strokeWidth={1.75} aria-hidden /> Word bank
            <span className="rounded-full bg-page px-1.5 text-[11px] font-normal text-muted">{shown.length}</span>
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setPractice((p) => !p);
                setRevealed(new Set());
              }}
              aria-pressed={practice}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${
                practice ? "border-ink bg-ink text-white" : "border-line text-muted hover:text-ink"
              }`}
              title="Hide meanings to test yourself"
            >
              {practice ? <EyeOff className="size-3.5" strokeWidth={1.75} /> : <Eye className="size-3.5" strokeWidth={1.75} />}
              Practice
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={shown.length === 0}
              className="grid size-8 place-items-center rounded-full text-muted hover:bg-page hover:text-ink disabled:opacity-30"
              aria-label="Download as CSV"
              title="Download as CSV"
            >
              <Download className="size-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <div className="grid grid-cols-2 rounded-full border border-line bg-page/60 p-0.5 text-xs">
            {(["book", "all"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                aria-pressed={scope === s}
                className={`rounded-full px-2.5 py-1 ${scope === s ? "bg-ink text-white" : "text-muted"}`}
              >
                {s === "book" ? "This book" : "All books"}
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="h-8 min-w-0 flex-1 rounded-full border border-line bg-white px-3 text-xs outline-none focus:border-black/30"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
        {shown.length === 0 && (
          <div className="rounded-2xl bg-page/70 p-4 text-sm leading-relaxed text-ink/80">
            <p className="font-medium">No words yet.</p>
            <p className="mt-1 text-muted">
              Double-click (or long-press) any word in the book, then choose <span className="text-ink">Save word</span>.
              Its meaning and the sentence it came from are saved here.
            </p>
          </div>
        )}
        {shown.map((w) => {
          const hidden = practice && !revealed.has(w.id);
          return (
            <article key={w.id} className="rounded-2xl border border-line bg-white p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-serif text-lg leading-tight">{w.word}</h3>
                  {w.phonetic && <p className="font-mono text-[11px] text-muted">{w.phonetic}</p>}
                </div>
                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    onClick={() => onSpeak(w.word)}
                    className="grid size-7 place-items-center rounded-full text-muted hover:bg-page hover:text-ink"
                    aria-label={`Say ${w.word}`}
                  >
                    <Volume2 className="size-3.5" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(w.id)}
                    className="grid size-7 place-items-center rounded-full text-muted hover:bg-page hover:text-ink"
                    aria-label={`Remove ${w.word}`}
                  >
                    <X className="size-3.5" strokeWidth={1.75} />
                  </button>
                </div>
              </div>

              {hidden ? (
                <button
                  type="button"
                  onClick={() => setRevealed((r) => new Set(r).add(w.id))}
                  className="mt-2 w-full rounded-xl border border-dashed border-line py-2 text-xs text-muted hover:text-ink"
                >
                  Think of the meaning, then tap to reveal
                </button>
              ) : (
                <>
                  {w.definition && <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink/85">{w.definition}</p>}
                  {w.aiNote && (
                    <div className="markdown mt-2 rounded-xl bg-page/70 px-3 py-2 text-[13px]">
                      <Markdown text={w.aiNote} />
                    </div>
                  )}
                  {!w.definition && !w.aiNote && !loadingIds.has(w.id) && (
                    <p className="mt-1.5 text-xs text-muted">No dictionary entry found.</p>
                  )}
                </>
              )}

              {w.context && (
                <blockquote className="mt-2 border-l-2 border-line pl-2.5 font-serif text-[13px] italic leading-relaxed text-muted">
                  {w.context}
                </blockquote>
              )}
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="truncate text-[11px] text-muted">
                  {scope === "all" ? `${w.bookTitle} · ` : ""}
                  {w.chapterTitle}
                </p>
                {!w.aiNote && (
                  <button
                    type="button"
                    onClick={() => onExplain(w)}
                    disabled={loadingIds.has(w.id)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line px-2 py-1 text-[11px] text-muted hover:text-ink disabled:opacity-60"
                  >
                    {loadingIds.has(w.id) ? (
                      <LoaderCircle className="size-3 animate-spin" strokeWidth={1.75} aria-hidden />
                    ) : (
                      <Sparkles className="size-3" strokeWidth={1.75} aria-hidden />
                    )}
                    Explain in context
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <form
        className="border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (newWord.trim()) onAdd(newWord.trim());
          setNewWord("");
        }}
      >
        <div className="flex items-center gap-2 rounded-full border border-line bg-white p-1 pl-3.5 focus-within:border-black/30">
          <input
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            maxLength={60}
            placeholder="Add a word yourself"
            className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70"
          />
          <button type="submit" disabled={!newWord.trim()} className="rounded-full bg-ink px-3.5 py-1.5 text-xs font-medium text-white disabled:opacity-30">
            Add
          </button>
        </div>
      </form>
    </div>
  );
}
