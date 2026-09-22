import { createRequire } from "node:module";
import { joinTextPieces, type TextPiece } from "@/lib/pdf-text";
import type { DocumentProcessor, ProcessorInput, ProcessorPage, ProcessorResult } from "./types";

/**
 * Where pdf.js's worker lives on this machine, resolved at runtime.
 *
 * The comment that used to sit below this said the legacy build needs no
 * worker and runs the parser in-process. That is not true, and the database
 * has been recording how untrue for weeks: every lecture a student attached
 * came back
 *
 *   Setting up fake worker failed: "Cannot find module
 *   '/var/task/.next/server/chunks/pdf.worker.mjs'"
 *
 * pdf.js always sets up a worker. In Node it uses a "fake" one — same code,
 * same process, no thread — but it still *imports the worker module* to get
 * it, and with nothing told to it, it guesses a path next to whatever chunk
 * the bundler happened to put `pdf.mjs` in. Nothing ever writes a file there.
 * The guess changed shape as the build changed (`.next/server/chunks/…` when
 * bundled, `node_modules/pdfjs-dist/…` once `serverExternalPackages` kept it
 * out of the bundle) and was wrong every time, because the real problem is
 * that the worker file was not in the deployed function at all.
 *
 * So: stop guessing. `createRequire().resolve` gives the actual path of the
 * actual file, and next.config.ts names that file in `outputFileTracingIncludes`
 * so it is deployed alongside the function rather than left behind in a
 * `node_modules` the Lambda never received.
 *
 * Resolved once, at module load, and deliberately not thrown from: a PDF whose
 * text cannot be extracted is still a PDF the student can read — the viewer
 * renders it in the browser and never asks this file anything. Losing search
 * over a deck is worth saying; losing the deck is not.
 */
function resolveWorker(): string | null {
  try {
    return createRequire(import.meta.url).resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
  } catch {
    return null;
  }
}

/**
 * The font and character-map data, as directories on disk.
 *
 * The browser is handed these as URLs under `/pdfjs/` (see src/lib/pdf.ts).
 * Node has no origin to serve from, so it takes filesystem paths instead —
 * with the trailing separator pdf.js expects, because it concatenates a file
 * name onto whatever it is given.
 *
 * This is not cosmetic and it is not only about drawing. Without `cMapUrl` a
 * CID-keyed font has no code-to-glyph mapping, and CID-keyed is what almost
 * every non-Latin PDF uses — so an Arabic lecture extracts as mojibake or as
 * nothing at all, silently, while pdf.js logs a warning nobody reads. The
 * extraction then "succeeds" with empty pages, which is worse than failing:
 * `likelyScanned` turns true and the deck is quietly written off as a scan.
 */
function resolveAssets(): { standardFontDataUrl?: string; cMapUrl?: string } {
  try {
    const require_ = createRequire(import.meta.url);
    const pkg = require_.resolve("pdfjs-dist/package.json");
    const root = pkg.slice(0, pkg.length - "package.json".length);
    return { standardFontDataUrl: `${root}standard_fonts/`, cMapUrl: `${root}cmaps/` };
  } catch {
    return {};
  }
}

/**
 * Extracts text from text-based PDFs using pdfjs-dist's "legacy" build, which
 * is the one built to run outside a browser. Reuses the same pdfjs-dist
 * dependency already installed for the client-side slide annotator, so this
 * needed no new dependency.
 */
export const pdfTextProcessor: DocumentProcessor = {
  id: "pdf-text-processor",

  supports(mimeType) {
    return mimeType === "application/pdf";
  },

  async process(input: ProcessorInput): Promise<ProcessorResult> {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

    /* Named before the first `getDocument`, because that is when pdf.js goes
       looking. Left alone when it cannot be resolved, so the failure is
       pdf.js's own message rather than one this file invented. */
    const worker = resolveWorker();
    if (worker) pdfjsLib.GlobalWorkerOptions.workerSrc = worker;

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(input.fileBytes),
      ...resolveAssets(),
      cMapPacked: true,
      /* False on the server for the same reason it is false in the browser
         (see src/lib/pdf.ts): pdf.js would otherwise reach for local copies of
         the standard fonts. A Lambda has none, so the reach is pure latency —
         and this processor only ever reads `item.str`, which no font affects. */
      useSystemFonts: false,
    });
    const doc = await loadingTask.promise;

    const pages: ProcessorPage[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      /* Was `.join(" ")`, which put a space between every glyph run whether or
         not the PDF had one — so a deck that splits on kerning came out as
         "1.TheM echan ics o fVen tila tion". The geometry says where the real
         spaces are; see src/lib/pdf-text.ts. */
      const pieces = content.items.filter((item): item is typeof item & TextPiece => "str" in item);
      const text = joinTextPieces(pieces)
        .replace(/[ \t]+/g, " ")
        .replace(/\s*\n\s*/g, "\n")
        .trim();
      pages.push({ pageNumber, text });
      page.cleanup();
    }
    await loadingTask.destroy();

    const extractedText = pages.map((p) => p.text).filter(Boolean).join("\n\n") || null;
    const wordCount = extractedText ? extractedText.split(/\s+/).filter(Boolean).length : 0;

    // A real, text-carrying PDF with (almost) nothing extracted is very
    // likely a scanned/image-only PDF — not a failure, just out of scope
    // for this processor (a future PDF-page-image OCR step could pick
    // this up; flagging it here is exactly that extension point).
    const likelyScanned = doc.numPages > 0 && wordCount < doc.numPages * 3;

    return {
      extractedText,
      pages,
      pageCount: doc.numPages,
      metadata: { wordCount, likelyScanned },
    };
  },
};
