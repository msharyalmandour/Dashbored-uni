import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pdfTextProcessor } from "./pdf-text-processor";
import { ocrProcessor } from "./ocr-processor";
import { textProcessor, isPlainTextName } from "./text-processor";
import { ooxmlProcessor, isOoxmlName } from "./ooxml-processor";
import { audioProcessor, isAudioName } from "./audio-processor";
import type { DocumentProcessor } from "./types";

export * from "./types";
export { pdfTextProcessor } from "./pdf-text-processor";
export { ocrProcessor, setOcrProvider, type OcrProvider } from "./ocr-processor";
export { textProcessor } from "./text-processor";
export { ooxmlProcessor } from "./ooxml-processor";
export { audioProcessor } from "./audio-processor";

/**
 * The processor registry. Adding a new capability (classification, an AI
 * pass, embeddings, …) is: write a module implementing DocumentProcessor,
 * add it here. Nothing about the upload path, the job runner, or any
 * other processor needs to change.
 */
const PROCESSORS: DocumentProcessor[] = [
  pdfTextProcessor,
  textProcessor,
  ooxmlProcessor,
  audioProcessor,
  ocrProcessor,
];

/**
 * `fileName` is consulted as well as the mime type because browsers report
 * `type` as an empty string for markdown, CSV and several other plain-text
 * formats — matching on mime alone left those files with no processor and no
 * extracted text, for no reason other than a missing header.
 */
export function getProcessorFor(mimeType: string, fileName = ""): DocumentProcessor | null {
  const byMime = PROCESSORS.find((p) => p.supports(mimeType));
  if (byMime) return byMime;
  if (isOoxmlName(fileName)) return ooxmlProcessor;
  // By name as well as mime, because a browser reports an empty `type` for a
  // recording often enough — and because `.webm` and `.mp4` can be either
  // sound or video, so the audio processor only claims one when it is
  // configured to do anything with it.
  if (isAudioName(fileName) && audioProcessor.supports("audio/mpeg")) return audioProcessor;
  return isPlainTextName(fileName) ? textProcessor : null;
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
    const processor = getProcessorFor(doc.mimeType, doc.originalName);
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
