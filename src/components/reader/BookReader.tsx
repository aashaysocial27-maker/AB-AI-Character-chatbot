"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookA, BookOpen, BookmarkPlus, FileText, GraduationCap, ListTree, LoaderCircle, Play, Sparkles, Volume2, X } from "lucide-react";
import { getProvider, type ProviderId } from "@/lib/providers";
import { useSessionKey } from "@/lib/useSessionKey";
import { chapterContext, lookupWord, streamAsk } from "@/lib/reader/ask";
import { parsePdf } from "@/lib/reader/extract";
import { splitUnits } from "@/lib/reader/layout";
import { offsetAt, rectsFor, unitRanges } from "@/lib/reader/positions";
import {
  clearProgressStore,
  getBookmarks,
  getHeard,
  layoutOf,
  markHeard,
  setBookmarks as storeBookmarks,
  setHeard as storeHeard,
  setSummary,
  statsOf,
  type Bookmark,
  type Heard,
} from "@/lib/reader/progress";
import {
  deleteBook,
  getAiSettings,
  getProgress,
  getVoiceSettings,
  getWords,
  listBooks,
  loadBook,
  saveBook,
  setAiSettings,
  setProgress,
  setVoiceSettings,
  setWords as storeWords,
  type VoiceSettings,
} from "@/lib/reader/storage";
import type { BookSummary, StoredBook, WordEntry } from "@/lib/reader/types";
import { useSpeech, useVoices } from "@/lib/reader/useSpeech";
import { AskPanel } from "./AskPanel";
import { ChapterPanel } from "./ChapterPanel";
import { BookView, type Selection } from "./BookView";
import { Library } from "./Library";
import { PageView } from "./PageView";
import { PlayerBar } from "./PlayerBar";
import { WordBank } from "./WordBank";

type Panel = "chapters" | "ask" | "words" | null;

const DEFAULT_AI = { provider: "anthropic" as ProviderId, model: "claude-sonnet-5-5" };

export function BookReader() {
  // ---- library ----
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [book, setBook] = useState<StoredBook | null>(null);
  const [busy, setBusy] = useState(false);
  const [parseProgress, setParseProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ---- reading ----
  const [chapterIdx, setChapterIdx] = useState(0);
  const [view, setView] = useState<"book" | "original">("book");
  /** A page the reader turned to by hand in the Original view; holds until reading moves on. */
  const [pageOverride, setPageOverride] = useState<{ chapter: number; unit: number; page: number } | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // ---- voice ----
  const { voices, supported } = useVoices();
  // The page renders only in the browser (see app/reader/page.tsx), so localStorage can seed state directly.
  const [voiceSettings, setVoiceState] = useState<VoiceSettings>(getVoiceSettings);

  // ---- AI ----
  const [ai] = useState(() => {
    const saved = getAiSettings();
    return saved && getProvider(saved.provider) ? (saved as { provider: ProviderId; model: string }) : DEFAULT_AI;
  });
  const [providerId, setProviderId] = useState<ProviderId>(ai.provider);
  const [model, setModel] = useState(ai.model);
  const [apiKey, setApiKey] = useSessionKey(providerId);
  const [seed, setSeed] = useState<{ text: string; n: number } | null>(null);

  const [openaiKey, setOpenaiKey] = useSessionKey("openai");

  // ---- progress ----
  const [heard, setHeardState] = useState<Heard>({});
  const [bookmarks, setBookmarkState] = useState<Bookmark[]>([]);
  const [resumeCard, setResumeCard] = useState<{ chapter: number; unit: number; page: number; snippet: string } | null>(null);
  /** A teacher check-in in progress: the explanation text as it arrives. */
  const [teacher, setTeacher] = useState<{ text: string; loading: boolean } | null>(null);
  const teacherThen = useRef<(() => void) | null>(null);
  const teacherAbort = useRef<AbortController | null>(null);
  const checkInFrom = useRef(0);

  // ---- word bank ----
  const [words, setWordsState] = useState<WordEntry[]>(getWords);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  // Books are listed from IndexedDB once the page is open.
  useEffect(() => {
    void listBooks().then(setBooks);
  }, []);

  const updateWords = useCallback((fn: (w: WordEntry[]) => WordEntry[]) => {
    setWordsState((prev) => {
      const next = fn(prev);
      storeWords(next);
      return next;
    });
  }, []);

  const updateVoice = (patch: Partial<VoiceSettings>) => {
    setVoiceState((v) => {
      const next = { ...v, ...patch };
      setVoiceSettings(next);
      return next;
    });
  };

  const voice = useMemo(
    () => voices.find((v) => v.voiceURI === voiceSettings.voiceURI) ?? voices[0] ?? null,
    [voices, voiceSettings.voiceURI],
  );

  // ---- current chapter as speakable units ----
  const chapter = book?.chapters[chapterIdx] ?? null;
  const { unitsByParagraph, unitTexts, unitParagraph, unitStart } = useMemo(() => {
    const byPara: { text: string; index: number }[][] = [];
    const texts: string[] = [];
    const para: number[] = [];
    const starts: number[] = [];
    chapter?.paragraphs.forEach((p, pi) => {
      const units = splitUnits(p);
      const ranges = unitRanges(p, units);
      byPara.push(
        units.map((text, k) => {
          texts.push(text);
          para.push(pi);
          starts.push(ranges[k][0]);
          return { text, index: texts.length - 1 };
        }),
      );
    });
    return { unitsByParagraph: byPara, unitTexts: texts, unitParagraph: para, unitStart: starts };
  }, [chapter]);

  const autoplay = useRef(false);
  const pendingUnit = useRef<number | null>(null);
  const paragraphEnds = useMemo(() => unitParagraph.map((p, i) => unitParagraph[i + 1] !== p), [unitParagraph]);

  // ---- progress: which sentences were heard, per chapter and page ----
  const bookLayout = useMemo(() => (book ? layoutOf(book) : null), [book]);
  const stats = useMemo(() => (bookLayout ? statsOf(bookLayout, heard) : null), [bookLayout, heard]);
  const unitPages = bookLayout?.chapters[chapterIdx]?.pages ?? [];

  const updateHeard = (fn: (h: Heard) => Heard) => {
    if (!book) return;
    const id = book.id;
    setHeardState((prev) => {
      const next = fn(prev);
      if (next !== prev) storeHeard(id, next);
      return next;
    });
  };

  const goNextChapter = () => {
    if (book && chapterIdx < book.chapters.length - 1) {
      autoplay.current = true;
      setChapterIdx(chapterIdx + 1);
    }
  };

  const speech = useSpeech({
    units: unitTexts,
    paragraphEnds,
    engine: voiceSettings.engine,
    style: voiceSettings.style,
    voice,
    rate: voiceSettings.rate,
    pitch: voiceSettings.pitch,
    openai: { apiKey: openaiKey, voice: voiceSettings.openaiVoice, model: voiceSettings.openaiModel },
    onUnitDone: (i) => updateHeard((h) => markHeard(h, chapterIdx, i, unitTexts.length)),
    onFinished: () => {
      if (voiceSettings.checkIns !== "off") runCheckIn(checkInFrom.current, unitTexts.length - 1, goNextChapter, true);
      else goNextChapter();
    },
    shouldHold: (i) => {
      if (voiceSettings.checkIns !== "page") return false;
      const turnsPage = unitPages[i] !== undefined && unitPages[i + 1] !== undefined && unitPages[i + 1] !== unitPages[i];
      const enough = unitTexts.slice(checkInFrom.current, i + 1).join("").length > 400;
      return turnsPage && enough;
    },
    onHold: (i) => runCheckIn(checkInFrom.current, i, () => speech.resume()),
    onError: (message) => setToast(message),
  });

  /**
   * Teacher check-in: pause, have the AI explain what was just read, speak the
   * explanation in the reading voice, then carry on with `then`.
   */
  function runCheckIn(from: number, to: number, then: () => void, chapterEnd = false) {
    const passage = unitTexts.slice(Math.max(0, from), to + 1).join("").trim().slice(-11_000);
    checkInFrom.current = to + 1;
    if (!passage || !book || !chapter) return then();
    teacherAbort.current?.abort();
    const controller = new AbortController();
    teacherAbort.current = controller;
    teacherThen.current = then;
    setTeacher({ text: "", loading: true });
    void (async () => {
      let text = "";
      try {
        for await (const chunk of streamAsk(
          {
            provider: providerId,
            model,
            task: "explain",
            bookTitle: book.title,
            chapterTitle: chapter.title + (chapterEnd ? " (end of chapter)" : ""),
            context: "",
            passage,
            messages: [{ role: "user", text: chapterEnd ? "We just finished this chapter. Explain it briefly." : "Explain what we just read." }],
          },
          apiKey,
          controller.signal,
        )) {
          text += chunk;
          setTeacher({ text, loading: true });
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        setTeacher(null);
        teacherThen.current = null;
        setToast(
          /key/i.test(String(e))
            ? "Teacher explanations need an AI key: add one in Ask → AI settings."
            : e instanceof Error
              ? e.message
              : "The teacher could not explain this part.",
        );
        return then();
      }
      if (controller.signal.aborted) return;
      setTeacher({ text, loading: false });
      speech.say(text, () => finishCheckIn());
    })();
  }

  /** Ends a check-in (spoken, skipped or interrupted) and carries on reading. */
  function finishCheckIn() {
    teacherAbort.current?.abort();
    const then = teacherThen.current;
    teacherThen.current = null;
    setTeacher(null);
    then?.();
  }

  // When the chapter changes: jump to the saved spot, or keep reading from the top.
  // (Not when the same chapter is only refreshed, e.g. after line positions are added.)
  const chapterKey = book && chapter ? `${book.id}:${chapterIdx}` : "";
  const lastChapterKey = useRef("");
  useEffect(() => {
    if (!chapter || chapterKey === lastChapterKey.current) return;
    lastChapterKey.current = chapterKey;
    checkInFrom.current = pendingUnit.current ?? 0;
    if (autoplay.current) {
      autoplay.current = false;
      speech.speakFrom(pendingUnit.current ?? 0);
    } else {
      speech.seek(pendingUnit.current ?? 0);
    }
    pendingUnit.current = null;
    // Only when the chapter itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterKey]);

  // Remember where the reader is.
  useEffect(() => {
    if (book) setProgress(book.id, { chapter: chapterIdx, unit: speech.index, updatedAt: Date.now() });
  }, [book, chapterIdx, speech.index]);

  // Keep the library card's progress up to date.
  useEffect(() => {
    if (!book || !stats) return;
    setSummary(book.id, {
      percent: stats.percent,
      pagesRead: stats.pagesRead.size,
      pageCount: book.pageCount,
      chaptersDone: stats.chaptersDone,
      chapterCount: book.chapters.length,
    });
  }, [book, stats]);

  // Where the sentence and word being read sit on the original pages.
  const sentenceRects = useMemo(() => {
    const p = unitParagraph[speech.index];
    if (!chapter?.spans || p === undefined) return [];
    const start = unitStart[speech.index];
    return rectsFor(chapter.spans[p], start, start + (unitTexts[speech.index]?.trimEnd().length ?? 0));
  }, [chapter, unitParagraph, unitStart, unitTexts, speech.index]);
  const wordRects = useMemo(() => {
    const w = speech.word;
    const p = w ? unitParagraph[w.unit] : undefined;
    if (!w || !chapter?.spans || p === undefined) return [];
    const start = unitStart[w.unit] + w.start;
    return rectsFor(chapter.spans[p], start, start + Math.max(1, w.length));
  }, [chapter, unitParagraph, unitStart, speech.word]);

  // The Original view follows the reading position: the exact page when line
  // positions are known, otherwise estimated by share of the chapter.
  const followPage = sentenceRects.length
    ? sentenceRects[0].page + 1
    : chapter
      ? chapter.startPage +
        Math.round((unitTexts.length ? speech.index / unitTexts.length : 0) * (chapter.endPage - chapter.startPage))
      : 1;
  const originalPage =
    pageOverride && pageOverride.chapter === chapterIdx && pageOverride.unit === speech.index ? pageOverride.page : followPage;

  // Headphone / lock-screen buttons.
  useEffect(() => {
    if (!("mediaSession" in navigator) || !book || !chapter) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: chapter.title, artist: book.author ?? "", album: book.title });
    const set = (a: MediaSessionAction, h: MediaSessionActionHandler | null) => {
      try {
        navigator.mediaSession.setActionHandler(a, h);
      } catch {
        // unsupported action
      }
    };
    set("play", () => togglePlay());
    set("pause", () => speech.pause());
    set("nexttrack", () => changeChapter(1));
    set("previoustrack", () => changeChapter(-1));
    return () => {
      (["play", "pause", "nexttrack", "previoustrack"] as MediaSessionAction[]).forEach((a) => set(a, null));
    };
  });

  // Space bar = play / pause.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " " || !book) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, button, [contenteditable]")) return;
      e.preventDefault();
      togglePlay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ---- actions ----
  async function addFile(file: File) {
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
      setError("Please choose a PDF file.");
      return;
    }
    setBusy(true);
    setError(null);
    setParseProgress(null);
    try {
      const parsed = await parsePdf(file, (done, total) => setParseProgress({ done, total }));
      await saveBook(parsed, file).catch(() => {
        // Too big for this browser's storage: it still opens, it just won't be kept.
      });
      setBooks(await listBooks());
      openStored({ ...parsed, file, addedAt: Date.now() });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        /password/i.test(msg)
          ? "This PDF is password-protected. Remove the password and try again."
          : "Could not read this PDF. It may be damaged or in an unusual format.",
      );
    } finally {
      setBusy(false);
      setParseProgress(null);
    }
  }

  function openStored(b: StoredBook) {
    speech.stop();
    const saved = getProgress(b.id);
    const ch = saved && saved.chapter < b.chapters.length ? saved.chapter : 0;
    pendingUnit.current = saved && saved.chapter === ch ? saved.unit : 0;
    setHeardState(getHeard(b.id));
    setBookmarkState(getBookmarks(b.id));
    setTeacher(null);
    setResumeCard(null);
    if (saved && (saved.chapter > 0 || saved.unit > 0)) {
      const units = (b.chapters[ch]?.paragraphs ?? []).flatMap((p) => splitUnits(p));
      const snippet = units[saved.unit]?.trim() ?? "";
      if (snippet) {
        const pages = layoutOf({ ...b, chapters: [b.chapters[ch]] }).chapters[0]?.pages ?? [];
        setResumeCard({ chapter: ch, unit: saved.unit, page: pages[saved.unit] ?? b.chapters[ch].startPage, snippet });
      }
    }
    setBook(b);
    setChapterIdx(ch);
    setView("book");
    setPanel(null);
    setSelection(null);
    if (b.chapters.some((c) => c.paragraphs.length > 0 && !c.spans)) void addLinePositions(b);
  }

  /** Books saved before line positions existed: re-read the stored PDF once to add them. */
  async function addLinePositions(b: StoredBook) {
    try {
      const fresh = await parsePdf(new File([b.file], `${b.title}.pdf`, { type: "application/pdf" }));
      if (fresh.chapters.length !== b.chapters.length) return; // structure changed; keep the old book as it is
      const upgraded: StoredBook = { ...b, chapters: fresh.chapters };
      await saveBook(upgraded, b.file).catch(() => {});
      setBook((cur) => (cur && cur.id === b.id ? { ...upgraded, addedAt: cur.addedAt } : cur));
    } catch {
      // Keep the book without line positions; the Original view still follows by page.
    }
  }

  async function openBook(id: string) {
    const b = await loadBook(id);
    if (b) openStored(b);
    else setError("That book could not be loaded. Add the PDF again.");
  }

  function changeChapter(delta: number, opts?: { to?: number }) {
    if (!book) return;
    const target = opts?.to ?? chapterIdx + delta;
    if (target < 0 || target >= book.chapters.length || target === chapterIdx) return;
    const wasPlaying = speech.status === "playing";
    cancelTeacher();
    speech.stop();
    autoplay.current = wasPlaying;
    setChapterIdx(target);
    setSelection(null);
  }

  function cancelTeacher() {
    teacherAbort.current?.abort();
    teacherThen.current = null;
    setTeacher(null);
  }

  /** Play/pause, which also ends a teacher check-in and goes back to the book. */
  function togglePlay() {
    setResumeCard(null);
    if (teacher) {
      cancelTeacher();
      speech.stopAside();
      speech.resume();
      return;
    }
    speech.toggle();
  }

  function jumpTo(target: number, unit: number, play = false) {
    if (!book) return;
    cancelTeacher();
    setResumeCard(null);
    if (target === chapterIdx) {
      if (play) speech.play(unit);
      else speech.seek(unit);
      return;
    }
    speech.stop();
    pendingUnit.current = unit;
    autoplay.current = play;
    setChapterIdx(target);
  }

  function addBookmark() {
    if (!book || !chapter) return;
    if (speech.status === "playing") speech.pause();
    const unit = speech.index;
    const b: Bookmark = {
      id: Date.now().toString(36),
      chapter: chapterIdx,
      unit,
      page: unitPages[unit] ?? chapter.startPage,
      snippet: (unitTexts[unit] ?? "").trim().slice(0, 140),
      createdAt: Date.now(),
    };
    setBookmarkState((prev) => {
      const next = [...prev.filter((x) => !(x.chapter === b.chapter && x.unit === b.unit)), b];
      storeBookmarks(book.id, next);
      return next;
    });
    setToast(`Bookmark saved: ${chapter.title}, page ${b.page}. Find it under Chapters → Bookmarks.`);
  }

  function markChapter(ci: number, read: boolean) {
    const count = bookLayout?.chapters[ci]?.lengths.length ?? 0;
    updateHeard((h) => ({ ...h, [ci]: read ? "1".repeat(count) : "" }));
  }

  function closeBook() {
    cancelTeacher();
    speech.stop();
    setBook(null);
    setSelection(null);
    void listBooks().then(setBooks);
  }

  const getContext = useCallback(
    () => (chapter ? chapterContext(chapter.paragraphs, unitParagraph[speech.index] ?? 0) : ""),
    [chapter, unitParagraph, speech.index],
  );

  function saveWord(text: string, context: string, openPanel = false) {
    if (!book || !chapter) return;
    const word = text.trim().slice(0, 60);
    if (!word) return;
    const existing = words.find((w) => w.word.toLowerCase() === word.toLowerCase() && w.bookId === book.id);
    if (existing) {
      setToast(`“${word}” is already in your word bank.`);
      if (openPanel) setPanel("words");
      return;
    }
    const entry: WordEntry = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      word,
      context: context.slice(0, 400),
      bookId: book.id,
      bookTitle: book.title,
      chapterTitle: chapter.title,
      addedAt: Date.now(),
    };
    updateWords((ws) => [entry, ...ws]);
    setToast(`Saved “${word}” to your word bank.`);
    if (openPanel) setPanel("words");
    setLoadingIds((s) => new Set(s).add(entry.id));
    void lookupWord(word).then((found) => {
      if (found) updateWords((ws) => ws.map((w) => (w.id === entry.id ? { ...w, ...found } : w)));
      setLoadingIds((s) => {
        const n = new Set(s);
        n.delete(entry.id);
        return n;
      });
    });
  }

  async function explainWord(entry: WordEntry) {
    setLoadingIds((s) => new Set(s).add(entry.id));
    let text = "";
    try {
      const sameBook = book && entry.bookId === book.id;
      for await (const chunk of streamAsk(
        {
          provider: providerId,
          model,
          task: "define",
          bookTitle: entry.bookTitle,
          chapterTitle: entry.chapterTitle,
          context: sameBook ? getContext().slice(0, 20_000) : "",
          passage: entry.context,
          messages: [{ role: "user", text: `Word or phrase: "${entry.word}"\nSentence: "${entry.context}"` }],
        },
        apiKey,
        new AbortController().signal,
      )) {
        text += chunk;
      }
      updateWords((ws) => ws.map((w) => (w.id === entry.id ? { ...w, aiNote: text.trim() } : w)));
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Could not explain that word.");
      if (/key/i.test(String(e))) setPanel("ask");
    } finally {
      setLoadingIds((s) => {
        const n = new Set(s);
        n.delete(entry.id);
        return n;
      });
    }
  }

  const changeProvider = (id: ProviderId) => {
    const m = getProvider(id)!.defaultModel;
    setProviderId(id);
    setModel(m);
    setAiSettings({ provider: id, model: m });
  };
  const changeModel = (m: string) => {
    setModel(m);
    setAiSettings({ provider: providerId, model: m });
  };

  // ---- library screen ----
  if (!book || !chapter) {
    return (
      <main className="page-glow min-h-dvh">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 pt-5 text-sm">
          <Link href="/" className="inline-flex items-center gap-1.5 text-muted hover:text-ink">
            <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden /> Persona Chat
          </Link>
        </nav>
        <Library
          books={books}
          busy={busy}
          progress={parseProgress}
          error={error}
          onFile={(f) => void addFile(f)}
          onOpen={(id) => void openBook(id)}
          onDelete={(id) => {
            clearProgressStore(id);
            void deleteBook(id).then(() => listBooks().then(setBooks));
          }}
        />
      </main>
    );
  }

  const currentText = unitTexts[speech.index] ?? "";
  const sourceNote =
    book.chapterSource === "outline"
      ? "Chapters from the PDF's bookmarks."
      : book.chapterSource === "headings"
        ? "Chapters found from headings in the text."
        : "No chapter headings found, so pages are grouped.";

  const chapterList = stats && (
    <ChapterPanel
      chapters={book.chapters}
      current={chapterIdx}
      playing={speech.status === "playing"}
      stats={stats}
      pageCount={book.pageCount}
      sourceNote={sourceNote}
      bookmarks={bookmarks}
      onOpen={(i) => {
        changeChapter(0, { to: i });
        if (window.innerWidth < 1024) setPanel(null);
      }}
      onMark={markChapter}
      onReset={() => updateHeard(() => ({}))}
      onBookmark={(bm) => {
        jumpTo(bm.chapter, bm.unit);
        if (window.innerWidth < 1024) setPanel(null);
      }}
      onDeleteBookmark={(id) =>
        setBookmarkState((prev) => {
          const next = prev.filter((x) => x.id !== id);
          storeBookmarks(book.id, next);
          return next;
        })
      }
      onClose={() => setPanel(null)}
    />
  );

  const rightOpen = panel === "ask" || panel === "words";
  const headerBtn = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
      active ? "bg-ink text-white" : "text-ink/75 hover:bg-white hover:text-ink"
    }`;

  return (
    <main className="flex h-dvh flex-col bg-[#f3efe7]">
      {/* Header */}
      <header className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
        <button
          type="button"
          onClick={closeBook}
          className="grid size-9 shrink-0 place-items-center rounded-full text-ink/75 hover:bg-white hover:text-ink"
          aria-label="Back to your books"
          title="Your books"
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={() => setPanel(panel === "chapters" ? null : "chapters")}
          className={`${headerBtn(panel === "chapters")} lg:hidden`}
        >
          <ListTree className="size-4" strokeWidth={1.75} aria-hidden />
          <span className="hidden sm:inline">Chapters</span>
        </button>
        <div className="min-w-0 flex-1 px-1">
          <h1 className="truncate font-serif text-base leading-tight sm:text-lg">{book.title}</h1>
          <p className="truncate text-[11px] text-muted">
            Chapter {chapterIdx + 1} of {book.chapters.length} · {chapter.title}
          </p>
        </div>
        <div className="hidden rounded-full border border-black/[0.06] bg-white/60 p-0.5 sm:flex">
          <button type="button" onClick={() => setView("book")} className={headerBtn(view === "book")} aria-pressed={view === "book"}>
            <BookOpen className="size-3.5" strokeWidth={1.75} aria-hidden /> Book
          </button>
          <button
            type="button"
            onClick={() => setView("original")}
            className={headerBtn(view === "original")}
            aria-pressed={view === "original"}
          >
            <FileText className="size-3.5" strokeWidth={1.75} aria-hidden /> Original
          </button>
        </div>
        <button type="button" onClick={() => setPanel(panel === "ask" ? null : "ask")} className={headerBtn(panel === "ask")}>
          <Sparkles className="size-4" strokeWidth={1.75} aria-hidden />
          <span className="hidden sm:inline">Ask</span>
        </button>
        <button type="button" onClick={() => setPanel(panel === "words" ? null : "words")} className={headerBtn(panel === "words")}>
          <BookA className="size-4" strokeWidth={1.75} aria-hidden />
          <span className="hidden sm:inline">Words</span>
          {words.filter((w) => w.bookId === book.id).length > 0 && (
            <span className={`rounded-full px-1.5 text-[10px] ${panel === "words" ? "bg-white/20" : "bg-ink/10"}`}>
              {words.filter((w) => w.bookId === book.id).length}
            </span>
          )}
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* Chapters: sidebar on desktop, drawer on mobile */}
        <aside
          className={`${
            panel === "chapters" ? "fixed inset-0 z-40 bg-white" : "hidden"
          } lg:static lg:z-auto lg:block lg:w-64 lg:shrink-0 lg:bg-transparent lg:pl-3`}
        >
          <div className="h-full lg:rounded-3xl lg:border lg:border-black/[0.05] lg:bg-white/80 lg:pb-0 lg:shadow-card">{chapterList}</div>
        </aside>

        {/* Book */}
        <section className="flex min-w-0 flex-1 flex-col px-3 pb-3 sm:px-4">
          {book.looksScanned && (
            <p className="mb-2 rounded-2xl border border-[#f1c9b0] bg-[#fdf1e9] px-4 py-2 text-xs text-[#8a3d12]">
              This PDF looks like scanned images with little real text, so there is not much to read aloud. Use the
              Original view to see the pages.
            </p>
          )}
          <div className="flex rounded-full border border-black/[0.06] bg-white/60 p-0.5 sm:hidden">
            <button type="button" onClick={() => setView("book")} className={`${headerBtn(view === "book")} flex-1 justify-center`}>
              <BookOpen className="size-3.5" strokeWidth={1.75} aria-hidden /> Book
            </button>
            <button type="button" onClick={() => setView("original")} className={`${headerBtn(view === "original")} flex-1 justify-center`}>
              <FileText className="size-3.5" strokeWidth={1.75} aria-hidden /> Original
            </button>
          </div>
          {resumeCard && speech.status !== "playing" && (
            <div className="mb-2 flex items-center gap-3 rounded-2xl border border-[#cfe8da] bg-[#effaf3] px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[#1f6b47]">
                  Continue where you stopped · {book.chapters[resumeCard.chapter]?.title} · page {resumeCard.page}
                </p>
                <p className="truncate font-serif text-[13px] italic text-ink/70">“{resumeCard.snippet}”</p>
              </div>
              <button
                type="button"
                onClick={() => jumpTo(resumeCard.chapter, resumeCard.unit, true)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#1f6b47] px-3.5 py-1.5 text-xs font-medium text-white"
              >
                <Play className="size-3.5" fill="currentColor" strokeWidth={0} /> Continue
              </button>
              <button
                type="button"
                onClick={() => setResumeCard(null)}
                className="grid size-7 shrink-0 place-items-center rounded-full text-[#1f6b47]/70 hover:bg-white"
                aria-label="Dismiss"
              >
                <X className="size-3.5" strokeWidth={1.75} />
              </button>
            </div>
          )}
          <div className="min-h-0 flex-1 pt-2 sm:pt-0">
            {view === "book" ? (
              <BookView
                key={chapter.id}
                chapter={chapter}
                chapterNumber={chapterIdx + 1}
                unitsByParagraph={unitsByParagraph}
                current={speech.index}
                word={speech.word}
                follow
                onPick={(u) => {
                  setSelection(null);
                  if (speech.status === "playing") speech.play(u);
                  else speech.seek(u);
                }}
                onSelect={setSelection}
              />
            ) : (
              <PageView
                file={book.file}
                page={originalPage}
                pageCount={book.pageCount}
                onPage={(p) =>
                  setPageOverride({ chapter: chapterIdx, unit: speech.index, page: Math.max(1, Math.min(book.pageCount, p)) })
                }
                sentence={sentenceRects}
                word={wordRects}
                pageRead={stats?.pagesRead.has(originalPage) ?? false}
                onPoint={(pageIndex, x, y) => {
                  const hit = offsetAt(chapter.spans, pageIndex, x, y);
                  if (!hit) return;
                  const unit = unitsByParagraph[hit.paragraph]?.find(
                    (u, k, all) => k === all.length - 1 || unitStart[all[k + 1].index] > hit.offset,
                  );
                  if (!unit) return;
                  setPageOverride(null);
                  if (speech.status === "playing") speech.play(unit.index);
                  else speech.seek(unit.index);
                }}
              />
            )}
          </div>
          <div className="relative pt-3">
          {teacher && (
            <div className="absolute inset-x-0 bottom-full z-20 mb-1 rounded-2xl border border-[#d9d2f5] bg-[#f6f3ff]/95 px-4 py-3 shadow-card backdrop-blur">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-[#4b3aa8]">
                  <GraduationCap className="size-4" strokeWidth={1.75} aria-hidden /> Teacher
                  {teacher.loading && <LoaderCircle className="size-3.5 animate-spin" strokeWidth={2} aria-label="thinking" />}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    speech.stopAside();
                    finishCheckIn();
                  }}
                  className="rounded-full border border-[#d9d2f5] bg-white px-3 py-1 text-xs font-medium text-[#4b3aa8] hover:border-[#4b3aa8]/40"
                >
                  Continue reading
                </button>
              </div>
              <p className="mt-1.5 font-serif text-[15px] leading-relaxed text-ink/85">{teacher.text || "Thinking about what we just read…"}</p>
            </div>
          )}
            <PlayerBar
              status={speech.status}
              buffering={speech.buffering}
              supported={supported}
              unit={speech.index}
              unitCount={unitTexts.length}
              chapterTitle={chapter.title}
              chapterPercent={stats?.chapterPercent[chapterIdx] ?? 0}
              hasPrevChapter={chapterIdx > 0}
              hasNextChapter={chapterIdx < book.chapters.length - 1}
              onToggle={togglePlay}
              onStop={() => {
                cancelTeacher();
                speech.stop();
              }}
              onSkip={(d) => speech.seek(speech.index + d)}
              onChapter={(d) => changeChapter(d)}
              onSeek={speech.seek}
              onBookmark={addBookmark}
              voice={{
                engine: voiceSettings.engine,
                style: voiceSettings.style,
                checkIns: voiceSettings.checkIns,
                voices,
                voiceURI: voice?.voiceURI ?? "",
                rate: voiceSettings.rate,
                pitch: voiceSettings.pitch,
                openaiVoice: voiceSettings.openaiVoice,
                openaiModel: voiceSettings.openaiModel,
                openaiKey,
                onEngine: (engine) => updateVoice({ engine }),
                onStyle: (style) => updateVoice({ style }),
                onCheckIns: (checkIns) => updateVoice({ checkIns }),
                onVoice: (voiceURI) => updateVoice({ voiceURI }),
                onRate: (rate) => updateVoice({ rate }),
                onPitch: (pitch) => updateVoice({ pitch }),
                onOpenaiVoice: (openaiVoice) => updateVoice({ openaiVoice }),
                onOpenaiModel: (openaiModel) => updateVoice({ openaiModel: openaiModel || "gpt-4o-mini-tts" }),
                onOpenaiKey: setOpenaiKey,
                onPreview: () =>
                  speech.say(
                    voiceSettings.style === "teacher"
                      ? "Hello! I'll read this book with you slowly and clearly, and we'll stop to think about the important ideas."
                      : "Once upon a time, in a quiet village by the sea, a story was waiting to be told. Shall we begin?",
                  ),
              }}
            />
          </div>
        </section>

        {/* Ask / Words: side panel on desktop, sheet on mobile. Kept mounted to keep the conversation. */}
        <aside
          className={`${
            rightOpen ? "fixed inset-0 z-40 flex lg:static lg:z-auto" : "hidden"
          } flex-col bg-white lg:mr-3 lg:mb-3 lg:w-[24rem] lg:shrink-0 lg:overflow-hidden lg:rounded-3xl lg:border lg:border-black/[0.05] lg:shadow-card`}
        >
          <button
            type="button"
            onClick={() => setPanel(null)}
            className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-full bg-page text-muted lg:hidden"
            aria-label="Close panel"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
          <div className={panel === "ask" ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
            <AskPanel
              bookTitle={book.title}
              chapterTitle={chapter.title}
              getContext={getContext}
              passage={currentText}
              providerId={providerId}
              model={model}
              apiKey={apiKey}
              onProviderChange={changeProvider}
              onModelChange={changeModel}
              onApiKeyChange={setApiKey}
              onSpeak={speech.say}
              speakingText={speech.aside}
              onStopSpeaking={speech.stopAside}
              seed={seed}
            />
          </div>
          <div className={panel === "words" ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
            <WordBank
              words={words}
              bookId={book.id}
              loadingIds={loadingIds}
              onSpeak={speech.say}
              onExplain={(w) => void explainWord(w)}
              onRemove={(id) => updateWords((ws) => ws.filter((w) => w.id !== id))}
              onAdd={(w) => saveWord(w, currentText)}
            />
          </div>
        </aside>
      </div>

      {/* Popover for selected text */}
      {selection && selection.text && (
        <div
          className="fixed z-50 flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-full bg-ink p-1 text-xs text-white shadow-lg"
          style={{
            left: Math.min(Math.max(selection.x, 150), window.innerWidth - 150),
            top: Math.max(selection.y - 10, 56),
          }}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 hover:bg-white/15"
            onClick={() => {
              saveWord(selection.text, selection.context);
              setSelection(null);
              window.getSelection()?.removeAllRanges();
            }}
          >
            <BookmarkPlus className="size-3.5" strokeWidth={1.75} aria-hidden /> Save word
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 hover:bg-white/15"
            onClick={() => {
              setSeed({ text: `What does “${selection.text}” mean in this sentence: “${selection.context}”`, n: Date.now() });
              setPanel("ask");
              setSelection(null);
              window.getSelection()?.removeAllRanges();
            }}
          >
            <Sparkles className="size-3.5" strokeWidth={1.75} aria-hidden /> Ask AI
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 hover:bg-white/15"
            onClick={() => {
              speech.say(selection.text);
            }}
          >
            <Volume2 className="size-3.5" strokeWidth={1.75} aria-hidden /> Say
          </button>
          <button
            type="button"
            className="grid size-7 place-items-center rounded-full hover:bg-white/15"
            aria-label="Close"
            onClick={() => {
              setSelection(null);
              window.getSelection()?.removeAllRanges();
            }}
          >
            <X className="size-3.5" strokeWidth={1.75} />
          </button>
        </div>
      )}

      {toast && (
        <div role="status" className="fixed bottom-28 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-xs text-white shadow-lg">
          {toast}
        </div>
      )}
    </main>
  );
}
