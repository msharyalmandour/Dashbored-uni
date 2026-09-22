/* Server-only by construction: it reads Prisma and the storage bucket, both
   of which are unavailable in a browser. The codebase marks this by convention
   rather than with the `server-only` package, which it does not depend on. */
import { prisma } from "@/lib/prisma";
import {
  buildAnnotationNote,
  marksFromStrokes,
  resolveMarks,
  textBoxFrom,
  type Mark,
  type TextBox,
} from "@/lib/annotation-context";

/**
 * The student's own marks, read back and resolved against the lecture.
 *
 * Two things make this harder than a query.
 *
 * FIRST, OWNERSHIP. SlideAnnotation carries no userId — it belongs to a slide,
 * which belongs to a lecture, which belongs to a subject, which belongs to the
 * student. Every read here walks that chain in its own WHERE rather than
 * trusting a caller to have checked, because the one thing worse than an agent
 * that cannot see a student's marks is an agent that can see somebody else's.
 *
 * SECOND, GEOMETRY. Extraction stores per-page text but not where that text
 * sits, so there is nothing stored to resolve a mark against. Re-extracting the
 * whole deck to place a handful of strokes would be absurd, so only the pages
 * that actually carry marks are read — usually two or three out of forty-seven.
 *
 * Nothing here throws. A lecture whose marks cannot be read is a lecture
 * without marks, which is exactly what it was yesterday; taking the whole
 * reading down over an unreadable stroke would trade a missing feature for a
 * broken one.
 */

export type DownloadFile = (storagePath: string) => Promise<Buffer | null>;

/** Marks grouped by the deck they were drawn on, ownership already enforced. */
type DeckMarks = {
  slideId: string;
  storagePath: string | null;
  fileType: string;
  marks: Mark[];
};

/**
 * Every mark the student has made on one lecture.
 *
 * The chain is named in full — `slide.lecture.id` AND `slide.lecture.subject.userId`
 * — so neither another student's lecture nor this student's other lecture can
 * come back from this query.
 */
async function loadDeckMarks(userId: string, lectureId: string): Promise<DeckMarks[]> {
  const rows = await prisma.slideAnnotation.findMany({
    where: {
      slide: {
        lectureId,
        lecture: { subject: { userId } },
      },
    },
    select: {
      pageNumber: true,
      strokes: true,
      slide: {
        select: {
          id: true,
          fileType: true,
          fileUrl: true,
          document: { select: { storagePath: true } },
        },
      },
    },
    orderBy: [{ slideId: "asc" }, { pageNumber: "asc" }],
  });

  const byDeck = new Map<string, DeckMarks>();
  for (const row of rows) {
    const marks = marksFromStrokes(row.pageNumber, row.strokes);
    if (marks.length === 0) continue;
    const existing = byDeck.get(row.slide.id);
    if (existing) {
      existing.marks.push(...marks);
    } else {
      byDeck.set(row.slide.id, {
        slideId: row.slide.id,
        // The Document's path when there is one, the slide's own otherwise —
        // decks predating the Document layer still have a file to read.
        storagePath: row.slide.document?.storagePath ?? row.slide.fileUrl ?? null,
        fileType: row.slide.fileType,
        marks,
      });
    }
  }
  return [...byDeck.values()];
}

/**
 * Where the text sits on the pages that carry marks.
 *
 * Returns an empty map rather than throwing: without geometry the marks are
 * still reported, by region instead of by the words underneath, which is less
 * useful and perfectly honest.
 */
async function textBoxesForPages(
  bytes: Buffer,
  pages: number[]
): Promise<Map<number, TextBox[]>> {
  const out = new Map<number, TextBox[]>();
  try {
    const { createRequire } = await import("node:module");
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const req = createRequire(import.meta.url);
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = req.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
    } catch {
      /* The worker is traced into the deployment by next.config.ts; if it is
         somehow absent, pdf.js will say so and this returns empty. */
    }

    const doc = await pdfjsLib.getDocument({
      data: new Uint8Array(bytes),
      useSystemFonts: false,
    }).promise;

    for (const pageNumber of pages) {
      if (pageNumber < 1 || pageNumber > doc.numPages) continue;
      try {
        const page = await doc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        const content = await page.getTextContent();
        const boxes: TextBox[] = [];
        for (const item of content.items) {
          if (!("str" in item)) continue;
          const box = textBoxFrom(
            { str: item.str, transform: item.transform, width: item.width, height: item.height },
            viewport.width,
            viewport.height
          );
          if (box) boxes.push(box);
        }
        out.set(pageNumber, boxes);
        page.cleanup();
      } catch {
        // One unreadable page is one page reported by region instead.
      }
    }
  } catch {
    return out;
  }
  return out;
}

/**
 * The block describing this lecture's marks, ready to put in front of a model.
 *
 * Empty string when there is nothing to say — no marks, no file, no student.
 * The caller appends it or does not; it never needs to check.
 */
export async function readAnnotationNote(
  userId: string,
  lectureId: string,
  downloadFile: DownloadFile
): Promise<string> {
  try {
    const decks = await loadDeckMarks(userId, lectureId);
    if (decks.length === 0) return "";

    const notes: string[] = [];
    for (const deck of decks) {
      let boxes = new Map<number, TextBox[]>();
      if (deck.fileType === "pdf" && deck.storagePath) {
        const pages = [...new Set(deck.marks.map((m) => m.page))].sort((a, b) => a - b);
        const bytes = await downloadFile(deck.storagePath).catch(() => null);
        if (bytes) boxes = await textBoxesForPages(bytes, pages);
      }
      const resolved = deck.marks.map((mark) => {
        const [one] = resolveMarks([mark], boxes.get(mark.page) ?? []);
        return one;
      });
      const note = buildAnnotationNote(resolved);
      if (note) notes.push(note);
    }
    return notes.join("\n\n");
  } catch {
    // A lecture whose marks cannot be read is a lecture without marks.
    return "";
  }
}
