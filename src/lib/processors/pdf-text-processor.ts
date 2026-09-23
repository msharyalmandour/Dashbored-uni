import { configureWorker, resolvePdfAssets } from "@/lib/pdfjs-assets";
import { joinTextPieces, type TextPiece } from "@/lib/pdf-text";
import type { DocumentProcessor, ProcessorInput, ProcessorPage, ProcessorResult } from "./types";

/**
 * Finding pdf.js's own files is its own problem, and a subtle one — see
 * src/lib/pdfjs-assets.ts. It used to be solved here with
 * `createRequire().resolve(<literal>)`, which is correct in Node and returns a
 * module id after bundling: the worker id was handed to pdf.js and rejected
 * with `Invalid \`workerSrc\` type.`, and the assets path threw on it and
 * silently returned nothing, taking the CMaps with it. Both are now resolved
 * in one place that checks the result is a string and that the file is there.
 */

export const pdfTextProcessor: DocumentProcessor = {
  id: "pdf-text-processor",

  supports(mimeType) {
    return mimeType === "application/pdf";
  },

  async process(input: ProcessorInput): Promise<ProcessorResult> {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

    /* Named before the first `getDocument`, because that is when pdf.js goes
       looking. Guarded rather than trusted: the setter throws on a non-string,
       and that throw is what took every server-side PDF read down.

       Said out loud when it fails, rather than left for pdf.js to report in
       its own words. That is the whole history of this bug: the real problem
       was "the code cannot name the worker file", and what reached the
       student's record was `Invalid \`workerSrc\` type.` — a sentence that
       sent two rounds of investigation at the wrong thing. A deployment
       missing its own assets is an operator problem, and it should read like
       one. */
    if (!configureWorker(pdfjsLib.GlobalWorkerOptions)) {
      throw new Error(
        "pdf.js could not be found on the server, so this file was not read. " +
          "The pdfjs-dist package is missing from the deployed function."
      );
    }

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(input.fileBytes),
      ...resolvePdfAssets(),
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
