/** Shapes shared by the book reader (browser only). */

export interface Chapter {
  id: string;
  title: string;
  /** 1-based PDF page where the chapter starts. */
  startPage: number;
  /** 1-based PDF page where the chapter ends (inclusive). */
  endPage: number;
  /** Reflowed paragraphs, in reading order. */
  paragraphs: string[];
}

export interface ParsedBook {
  id: string;
  title: string;
  author?: string;
  pageCount: number;
  chapters: Chapter[];
  /** How the chapters were found, shown to the reader. */
  chapterSource: "outline" | "headings" | "pages";
  /** True when the PDF has little or no selectable text (a scan). */
  looksScanned: boolean;
}

export interface StoredBook extends ParsedBook {
  addedAt: number;
  file: Blob;
}

export interface BookSummary {
  id: string;
  title: string;
  author?: string;
  pageCount: number;
  chapterCount: number;
  addedAt: number;
}

/** One unit of speech: a sentence, or part of a long sentence. */
export interface SpeechUnit {
  /** Paragraph index inside the chapter. */
  p: number;
  /** Unit index inside the paragraph. */
  u: number;
  text: string;
}

export interface WordEntry {
  id: string;
  word: string;
  /** The sentence the word was found in. */
  context: string;
  bookId: string;
  bookTitle: string;
  chapterTitle: string;
  definition?: string;
  /** Meaning in context, from the AI. */
  aiNote?: string;
  phonetic?: string;
  addedAt: number;
}

export interface ReadingProgress {
  chapter: number;
  unit: number;
  updatedAt: number;
}
