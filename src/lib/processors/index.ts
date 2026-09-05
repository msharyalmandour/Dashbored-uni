import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pdfTextProcessor } from "./pdf-text-processor";
import { ocrProcessor } from "./ocr-processor";
import type { DocumentProcessor } from "./types";

export * from "./types";
export { pdfTextProcessor } from "./pdf-text-processor";
export { ocrProcessor, setOcrProvider, type OcrProvider } from "./ocr-processor";

/**
 * The processor registry. Adding a new capability (classification, an AI
 * pass, embeddings, …) is: write a module implementing DocumentProcessor,
 * add it here. Nothing about the upload path, the job runner, or any
 * other processor needs to change.
 */
const PROCESSORS: DocumentProcessor[] = [pdfTextProcessor, ocrProcessor];

export function getProcessorFor(mimeType: string): DocumentProcessor | null {
  return PROCESSORS.find((p) => p.supports(mimeType)) ?? null;
}

/**
 * Runs the full pipeline for one Document: PROCESSING → a matching
 * processor's output written back → COMPLETED, or FAILED with the error
 * recorded on the row. Never throws — a failure is state, not an
 * exception, so retrying later is just re-queuing the same document id.
 *
 * `downloadFile` is injected rather than imported directly so this stays
 * decoupled from *how* bytes are fetched — the background job passes the
 * service-role downloader (src/lib/document-storage.ts); nothing here
 * needs to know that.
 */
export async function runProcessingPipeline(
  documentId: string,
  downloadFile: (storagePath: string) => Promise<Buffer | null>
): Promise<void> {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) return;

  await prisma.document.update({
    where: { id: documentId },
    data: { processingStatus: "PROCESSING", processingError: null },
  });

  const existingMetadata = (doc.metadata as Record<string, unknown> | null) ?? {};

  try {
    const processor = getProcessorFor(doc.mimeType);
    if (!processor) {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          processingStatus: "COMPLETED",
          metadata: { ...existingMetadata, processor: "none", reason: "unsupported mime type" },
        },
      });
      return;
    }

    const fileBytes = await downloadFile(doc.storagePath);
    if (!fileBytes) {
      await prisma.document.update({
        where: { id: documentId },
        data: { processingStatus: "FAILED", processingError: "Could not download file for processing." },
      });
      return;
    }

    const result = await processor.process({
      documentId,
      mimeType: doc.mimeType,
      originalName: doc.originalName,
      fileBytes,
    });

    await prisma.document.update({
      where: { id: documentId },
      data: {
        processingStatus: "COMPLETED",
        extractedText: result.extractedText,
        pageCount: result.pageCount ?? doc.pageCount,
        metadata: {
          ...existingMetadata,
          processor: processor.id,
          pages: result.pages ?? null,
          ...result.metadata,
        } as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    await prisma.document.update({
      where: { id: documentId },
      data: {
        processingStatus: "FAILED",
        processingError: err instanceof Error ? err.message.slice(0, 2000) : "Unknown processing error",
      },
    });
  }
}
