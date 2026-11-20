"use client";

import type * as PdfJs from "pdfjs-dist";

let loader: Promise<typeof PdfJs> | null = null;

/** Loads pdf.js once, in the browser only, with its worker bundled by Next. */
export function loadPdfJs(): Promise<typeof PdfJs> {
  if (!loader) {
    loader = import("pdfjs-dist").then((pdfjs) => {
      if (!pdfjs.GlobalWorkerOptions.workerPort) {
        pdfjs.GlobalWorkerOptions.workerPort = new Worker(
          new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
          { type: "module" },
        );
      }
      return pdfjs;
    });
  }
  return loader;
}

export async function openPdf(data: ArrayBuffer) {
  const pdfjs = await loadPdfJs();
  // pdf.js transfers the buffer to its worker, so hand it a copy.
  const task = pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) });
  const doc = await task.promise;
  return { doc, close: () => void task.destroy() };
}

export type PdfDocument = Awaited<ReturnType<typeof openPdf>>["doc"];
