import type { Metadata } from "next";
import { ReaderClient } from "./ReaderClient";

export const metadata: Metadata = {
  title: "Book Reader — PDF to read-aloud book",
  description:
    "Turn a PDF into a chaptered book, listen to it in a natural voice with pause and resume, ask questions about each chapter and build a word bank.",
};

export default function ReaderPage() {
  return <ReaderClient />;
}
