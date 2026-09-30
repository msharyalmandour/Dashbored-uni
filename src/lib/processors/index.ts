import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pdfTextProcessor } from "./pdf-text-processor";
import { ocrProcessor } from "./ocr-processor";
import { textProcessor, isPlainTextName } from "./text-processor";
import { ooxmlProcessor, isOoxmlName } from "./ooxml-processor";
import { audioProcessor, isAudioName } from "./audio-processor";
import { assessRead } from "@/lib/read-quality";
import { makeStorable, makeStorableJson } from "./text-safety";
import type { DocumentProcessor } from "./types";

export * from "./types";
export { pdfTextProcessor } from "./pdf-text-processor";
export { ocrProcessor, setOcrProvider, type OcrProvider } from "./ocr-processor";
export { textProcessor } from "./text-processor";
export { ooxmlProcessor } from "./ooxml-processor";
export { audioProcessor } from "./audio-processor";
export { makeStorable, makeStorableJson, type StorableText } from "./text-safety";

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

    /* Finishing is not the same as reading.
    
       This used to write COMPLETED whenever a processor returned without
       throwing — including when it returned nothing, or returned mojibake. The
       student saw a green tick, the agent filed from an empty string, and the
       failure stayed invisible for weeks because nothing looks more finished
       than a document that finished processing.
    
       The verdict is recorded beside the text so every later reader — the UI,
       the agent, a person looking at the row — can see what was actually got,
       without re-deriving it and without asking a model whether it understood.
       See src/lib/read-quality.ts. */
    /* Strip what Postgres cannot store BEFORE the read is assessed, so the
       verdict describes the text that ends up on the row rather than the text
       we happened to extract. See src/lib/processors/text-safety.ts — two of
       this account's documents died here with a 22021 from the database. */
    const storable = makeStorable(result.extractedText);

    const quality = assessRead({
      text: storable.text,
      pages: result.pages,
      pageCount: result.pageCount ?? undefined,
    });

    await prisma.document.update({
      where: { id: documentId },
      data: {
        processingStatus: "COMPLETED",
        extractedText: storable.text,
        pageCount: result.pageCount ?? doc.pageCount,
        /* Said on the row itself, not only in metadata, so it is visible to
           anyone reading the table — which is where this failure hid. An empty
           or mangled read is not an exception, so it does not become one; it is
           a fact about the document, recorded as one. */
        processingError:
          quality.verdict === "good"
            ? null
            : `Read as ${quality.verdict}${quality.reasons.length ? `: ${quality.reasons.join(", ")}` : ""}`,
        /* The whole object, not just the text: `metadata` is jsonb, the
           per-page text of a PDF lives in `pages[n].text`, and jsonb rejects
           a NUL with its own error (22P05) — so cleaning `extractedText`
           alone would only have changed which code the same two documents
           failed with. */
        metadata: makeStorableJson({
          ...existingMetadata,
          processor: processor.id,
          pages: result.pages ?? null,
          ...result.metadata,
          /* Silent for a clean read, and a plain count when it is not: a text
             layer with NULs in it is usually a damaged text layer, and this
             is the only trace of that anyone gets. */
          ...(storable.removed > 0 ? { unstorableCharactersRemoved: storable.removed } : {}),
          readQuality: { ...quality } as unknown as Prisma.InputJsonValue,
        }) as Prisma.InputJsonValue,
      },
    });
    /* The page count is known NOW, on the server, from the file itself. Tell
       the slides that point at this document, because they are the ones that
       need it and the only thing that used to tell them was a browser. */
    await syncSlidePageCount(documentId, result.pageCount ?? null);
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

/**
 * Teach the deck how many pages it has.
 *
 * WHY THIS EXISTS. `LectureSlide.pageCount` defaulted to 1 and was corrected
 * by the VIEWER, the first time a student opened the deck, from what pdf.js
 * reported. Three things had to go right for that to happen — the deck had to
 * be opened in the annotator specifically, the PDF had to parse in that
 * browser, and the write had to succeed (it was fired as `void`, so a failure
 * was silent) — and on the real account it did not. Measured:
 *
 *     Cardiovascular system    slide said 1 page   the file has 42
 *     mechanical ventilation   slide said 1 page   the file has 51
 *
 * The damage was not cosmetic. A deck of 51 pages that claims to have 1 is a
 * deck the reader will not page through, that "continue reading" can never
 * offer back (there is nowhere to continue TO), and — worst — one the student
 * is recorded as having FINISHED the moment they look at page one, because
 * reaching the end of a one-page document is what reaching page one is. That
 * false completion then propagated into course progress as a lecture done.
 *
 * So the count is written where it is first known, which is here: the server
 * has just parsed the file. This runs for every route in — a drop, an upload,
 * the agent — because they all end up in this pipeline, whereas the viewer
 * only ever covered decks somebody opened.
 *
 * The viewer's correction stays. It is now a fallback for the formats this
 * pipeline cannot count rather than the only mechanism, and it agrees with
 * this one when both run.
 */
async function syncSlidePageCount(documentId: string, pageCount: number | null): Promise<void> {
  if (pageCount === null || !Number.isFinite(pageCount) || pageCount < 1) return;

  /* Only where the deck does not already know better. The viewer may have
     corrected it from the real PDF in the meantime, and a processor that
     undercounts — an image-only PDF read by OCR, say — must not overwrite a
     larger true count with a smaller guess. */
  await prisma.lectureSlide.updateMany({
    where: { documentId, pageCount: { lt: pageCount } },
    data: { pageCount },
  });

  /* A completion recorded against the old, wrong count is now provably wrong:
     `furthestPage` only ever grows, so it can only fall short of `pageCount`
     if the count went UP — which means the student never reached the end, and
     the stamp was made on bad information. Clearing it is not losing data; it
     is withdrawing a claim the app should not have made. `advance` re-derives
     the same way, so this and the live path agree. */
  await prisma.$executeRaw`
    UPDATE "StudyPosition" sp
       SET "completedAt" = NULL
      FROM "LectureSlide" s
     WHERE s.id = sp."slideId"
       AND s."documentId" = ${documentId}
       AND sp."completedAt" IS NOT NULL
       AND sp."furthestPage" < s."pageCount"
  `;
}
