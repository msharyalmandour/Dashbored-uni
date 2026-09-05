import type { DocumentProcessor, ProcessorInput, ProcessorPage, ProcessorResult } from "./types";

/**
 * Extracts text from text-based PDFs using pdfjs-dist's Node-compatible
 * "legacy" build (no DOM/Worker required — it runs the parser in-process,
 * which is what makes this safe to call from a background job). Reuses
 * the same pdfjs-dist dependency already installed for the client-side
 * slide annotator, so this needed no new dependency.
 */
export const pdfTextProcessor: DocumentProcessor = {
  id: "pdf-text-processor",

  supports(mimeType) {
    return mimeType === "application/pdf";
  },

  async process(input: ProcessorInput): Promise<ProcessorResult> {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(input.fileBytes),
      useSystemFonts: true,
    });
    const doc = await loadingTask.promise;

    const pages: ProcessorPage[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
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
