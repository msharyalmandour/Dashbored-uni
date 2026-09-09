import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAiProvider } from "./provider";
import { VISION_MIME_TYPES } from "@/lib/capture-kinds";
import { captureAnalysisSchema, type CaptureAnalysis } from "./types";

/**
 * Fetches a stored file's bytes. Injected rather than imported so this module
 * stays out of the argument about *how* — the cron passes the service-role
 * downloader, a user action passes one scoped to that user's own token, and
 * neither can be used in the other's place.
 */
export type DownloadFile = (storagePath: string) => Promise<Buffer | null>;

/**
 * Anthropic caps request images at 5 MB base64. A photo straight off a phone
 * can exceed that, and there is no resizing available here, so an oversized
 * image is analysed by name and context instead of being sent — which is a
 * worse answer, but a real one, rather than a failed request.
 */
const MAX_IMAGE_BYTES = 3_500_000;

/**
 * A capture with no usable content cannot be classified by anything, model or
 * human. Rather than spend a request to be told "UNKNOWN", it is left alone.
 */
const MIN_ANALYZABLE_CHARS = 12;

/**
 * The content a capture actually offers the classifier.
 *
 * For a FILE this is the Document's extracted text, which the existing
 * processing pipeline produces asynchronously — so a file dropped seconds ago
 * legitimately has nothing to analyse yet, and that is a "come back later",
 * not a failure.
 */
function resolveContent(capture: {
  kind: "TEXT" | "FILE";
  text: string | null;
  document: {
    originalName: string;
    extractedText: string | null;
    processingStatus: string;
    mimeType: string;
  } | null;
}): { ready: false; reason: string } | { ready: true; content: string; fileName?: string } {
  if (capture.kind === "TEXT") {
    const content = capture.text?.trim() ?? "";
    if (content.length < MIN_ANALYZABLE_CHARS) {
      return { ready: false, reason: "Too short to classify." };
    }
    return { ready: true, content };
  }

  const doc = capture.document;
  if (!doc) return { ready: false, reason: "The file behind this capture is gone." };

  // An image the model can decode needs no extracted text: the picture is the
  // content, and waiting for a text-extraction pass that will never produce
  // anything is how a screenshot ends up permanently "still being read".
  if (VISION_MIME_TYPES.has(doc.mimeType)) {
    return { ready: true, content: doc.originalName, fileName: doc.originalName };
  }

  if (doc.processingStatus === "QUEUED" || doc.processingStatus === "PROCESSING") {
    return { ready: false, reason: "Still reading the file." };
  }

  const extracted = doc.extractedText?.trim() ?? "";
  if (extracted.length < MIN_ANALYZABLE_CHARS) {
    // A scanned deck with no OCR provider lands here. The file is fine; there
    // is simply no text to reason about, and saying so is more useful than
    // guessing from the filename.
    return { ready: false, reason: "No text could be read from this file." };
  }

  return { ready: true, content: extracted, fileName: doc.originalName };
}

/**
 * Analyses one capture and records the result on the row.
 *
 * Never throws: like the document pipeline, a failure is state (FAILED with a
 * reason the student can read) rather than an exception, so a retry is just
 * calling this again with the same id.
 *
 * The three outcomes it can produce are all honest ones:
 *   UNPROCESSED  no provider is configured, or there is nothing to read yet
 *   NEEDS_REVIEW a real model returned a proposal — still unconfirmed
 *   FAILED       the provider was called and could not deliver a usable answer
 *
 * There is no fourth outcome where the app invents a classification.
 */
export async function analyzeCapture(captureId: string, downloadFile?: DownloadFile): Promise<void> {
  const capture = await prisma.captureItem.findUnique({
    where: { id: captureId },
    select: {
      id: true,
      userId: true,
      kind: true,
      text: true,
      document: {
        select: {
          originalName: true,
          extractedText: true,
          processingStatus: true,
          mimeType: true,
          storagePath: true,
        },
      },
    },
  });
  if (!capture) return;

  const provider = getAiProvider();
  if (!provider) {
    await prisma.captureItem.update({
      where: { id: captureId },
      data: { status: "UNPROCESSED", error: null, analyzedBy: null },
    });
    return;
  }

  const resolved = resolveContent(capture);
  if (!resolved.ready) {
    await prisma.captureItem.update({
      where: { id: captureId },
      data: { status: "UNPROCESSED", error: resolved.reason },
    });
    return;
  }

  await prisma.captureItem.update({
    where: { id: captureId },
    data: { status: "ANALYZING", error: null },
  });

  try {
    // The provider is only ever shown this user's own subjects and topics, so
    // a proposal cannot reference another student's structure even if the
    // model were to ask for one.
    const [subjects, topics] = await Promise.all([
      prisma.subject.findMany({
        where: { userId: capture.userId, status: { not: "ARCHIVED" } },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      }),
      prisma.topic.findMany({
        where: { subject: { userId: capture.userId } },
        select: { name: true },
        distinct: ["name"],
        take: 100,
        orderBy: { name: "asc" },
      }),
    ]);

    const image = await loadImage(capture.document, downloadFile);

    const raw = await provider.analyzeCapture({
      content: resolved.content,
      source: capture.kind,
      fileName: resolved.fileName,
      subjects,
      knownTopics: topics.map((t) => t.name),
      today: new Date().toISOString().slice(0, 10),
      image,
    });

    const analysis = sanitize(raw, new Set(subjects.map((s) => s.id)));

    await prisma.captureItem.update({
      where: { id: captureId },
      data: {
        status: "NEEDS_REVIEW",
        analysis: analysis as unknown as Prisma.InputJsonValue,
        analyzedBy: provider.id,
        error: null,
      },
    });
  } catch (err) {
    await prisma.captureItem.update({
      where: { id: captureId },
      data: {
        status: "FAILED",
        error: err instanceof Error ? err.message.slice(0, 500) : "Analysis failed.",
      },
    });
  }
}

/**
 * The picture, when there is one worth sending.
 *
 * Returns undefined rather than throwing at every step where the answer is
 * "not this time" — an unsupported format, no downloader wired in, a file too
 * large, a read that failed. In each case the analysis still runs on what
 * context exists, which is a weaker answer but an honest one; the alternative
 * is failing a capture over an image that was optional to begin with.
 */
async function loadImage(
  document: { mimeType: string; storagePath: string } | null,
  downloadFile?: DownloadFile
): Promise<{ mediaType: string; base64: string } | undefined> {
  if (!document || !downloadFile) return undefined;
  if (!VISION_MIME_TYPES.has(document.mimeType)) return undefined;

  const bytes = await downloadFile(document.storagePath).catch(() => null);
  if (!bytes || bytes.byteLength > MAX_IMAGE_BYTES) return undefined;

  return { mediaType: document.mimeType, base64: bytes.toString("base64") };
}

/**
 * The last guard before a proposal is stored.
 *
 * The schema has already checked the shape; this checks the one thing a schema
 * cannot — that `subjectId` names a subject that exists and belongs to this
 * user. A hallucinated or borrowed id is dropped to null and the confidence
 * cut, so the UI asks instead of offering to file it somewhere wrong.
 */
function sanitize(analysis: CaptureAnalysis, ownSubjectIds: Set<string>): CaptureAnalysis {
  let result = analysis;

  if (result.subjectId && !ownSubjectIds.has(result.subjectId)) {
    result = { ...result, subjectId: null, confidence: Math.min(result.confidence, 0.3) };
  }

  // A matched course always beats inventing one, enforced here rather than
  // trusted to the model: proposing to create "Pharmacology" for a student who
  // already has it would offer them a duplicate of their own course.
  if (result.subjectId && result.proposedSubjectName) {
    result = { ...result, proposedSubjectName: null };
  }

  // A detected date is offered to the student as a real deadline, so an
  // unparseable one is dropped rather than shown. The event itself survives
  // with a null date — "there is an exam, I could not tell you when" is true
  // and useful; a date that is not a date is neither.
  const event = result.detectedEvent;
  if (event?.date && Number.isNaN(new Date(event.date).getTime())) {
    result = { ...result, detectedEvent: { ...event, date: null } };
  }

  return result;
}

/** Reads a stored proposal back. Returns null for anything that no longer parses. */
export function parseStoredAnalysis(value: unknown): CaptureAnalysis | null {
  const result = captureAnalysisSchema.safeParse(value);
  return result.success ? result.data : null;
}
