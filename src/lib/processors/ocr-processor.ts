import type { DocumentProcessor, ProcessorInput, ProcessorResult } from "./types";

/**
 * The OCR integration boundary. A real provider (Tesseract.js running
 * locally, or a hosted OCR API) implements this and is registered via
 * `setOcrProvider()` — nothing else in the pipeline changes when one is
 * added, and swapping providers later is a one-line change here, not a
 * pipeline rewrite.
 */
export interface OcrProvider {
  id: string;
  recognize(imageBytes: Buffer, mimeType: string): Promise<{ text: string; confidence?: number }>;
}

let activeProvider: OcrProvider | null = null;

export function setOcrProvider(provider: OcrProvider | null): void {
  activeProvider = provider;
}

/**
 * No provider is wired up yet (see Phase 3 report, section H) — that's a
 * deliberate scope boundary, not a bug. Without one, image documents are
 * marked COMPLETED (not FAILED — nothing went wrong) with no extracted
 * text and `metadata.ocrPending: true`, so a future provider can find
 * and reprocess them later without a separate migration.
 */
export const ocrProcessor: DocumentProcessor = {
  id: "ocr-processor",

  supports(mimeType) {
    return mimeType.startsWith("image/");
  },

  async process(input: ProcessorInput): Promise<ProcessorResult> {
    if (!activeProvider) {
      return {
        extractedText: null,
        metadata: { ocrProvider: "none", ocrPending: true },
      };
    }

    const result = await activeProvider.recognize(input.fileBytes, input.mimeType);
    return {
      extractedText: result.text || null,
      metadata: { ocrProvider: activeProvider.id, ocrConfidence: result.confidence ?? null },
    };
  },
};
