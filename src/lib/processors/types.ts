/**
 * The processor contract every file-intelligence step implements. A
 * processor is a pure, independently testable unit — it never touches
 * Prisma or Storage itself; the pipeline (index.ts) is the only thing
 * that reads the file and writes results back to the Document row. This
 * is what lets a new processor (OCR, classification, embeddings, …) be
 * added later without changing the upload path or any other processor.
 */

export interface ProcessorInput {
  documentId: string;
  mimeType: string;
  originalName: string;
  fileBytes: Buffer;
}

export interface ProcessorPage {
  pageNumber: number;
  text: string;
}

export interface ProcessorResult {
  /** Flattened full text, or null if nothing could be extracted. */
  extractedText: string | null;
  /** Per-page text, when the source format has pages (PDFs). */
  pages?: ProcessorPage[];
  pageCount?: number;
  /** Arbitrary processor-specific output, merged into Document.metadata. */
  metadata?: Record<string, unknown>;
}

export interface DocumentProcessor {
  /** Stable identifier, recorded in Document.metadata so results are traceable to the processor that produced them. */
  id: string;
  /** Whether this processor knows how to handle the given mime type. */
  supports(mimeType: string): boolean;
  /** Runs the processor. Throwing marks the document FAILED with the error message. */
  process(input: ProcessorInput): Promise<ProcessorResult>;
}
