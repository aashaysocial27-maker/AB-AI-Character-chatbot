"use client";

import dynamic from "next/dynamic";

/**
 * The reader uses browser-only APIs (speech, IndexedDB, pdf.js), so it is
 * rendered in the browser only.
 */
export const ReaderClient = dynamic(() => import("@/components/reader/BookReader").then((m) => m.BookReader), {
  ssr: false,
  loading: () => <main className="page-glow min-h-dvh" />,
});
