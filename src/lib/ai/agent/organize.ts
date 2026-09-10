import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { runProcessingPipeline } from "@/lib/processors";
import { VISION_MIME_TYPES } from "@/lib/capture-kinds";
import { runAgent, type AgentInput } from "./run";
import type { AgentContext } from "./tools";
import type { AgentRunResult } from "./types";

/**
 * Fetches a stored file's bytes.
 *
 * Injected rather than imported so this module stays out of the argument about
 * *how*: the nightly pass supplies the service-role downloader, a student's own
 * request supplies one scoped to their token, and neither can be used in the
 * other's place. Getting that backwards would read one student's file with
 * credentials that bypass the rules protecting everyone else's.
 */
export type DownloadFile = (storagePath: string) => Promise<Buffer | null>;

/**
 * Anthropic caps request images at 5 MB base64. A photo straight off a phone
 * can exceed that, and there is no resizing available here, so an oversized
 * image is described by name and context instead of being sent — a worse
 * answer, but a real one, rather than a failed request.
 */
const MAX_IMAGE_BYTES = 3_500_000;

/** How much of a long document is sent. The first pages carry the signal. */
const MAX_CONTENT_CHARS = 30_000;

/** A capture with nothing in it cannot be organised by anything, model or human. */
const MIN_ANALYZABLE_CHARS = 12;

/**
 * Extracts a dropped file's text now, on the request that dropped it.
 *
 * The claim is a conditional UPDATE rather than a read followed by a write, so
 * the nightly cron and a student dropping a file at the same moment cannot
 * both process one document: whoever flips QUEUED to PROCESSING owns it, and
 * the other sees zero rows changed and leaves it alone.
 */
async function readFileNow(documentId: string, downloadFile: DownloadFile): Promise<void> {
  const claimed = await prisma.document.updateMany({
    where: { id: documentId, processingStatus: "QUEUED" },
    data: { processingStatus: "PROCESSING" },
  });
  if (claimed.count === 0) return;
  await runProcessingPipeline(documentId, downloadFile);
}

/** The picture, when there is one worth sending. */
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
 * Organises one dropped item, end to end.
 *
 * This replaces a two-stage design — classify into a fixed shape, then let a
 * switch statement decide what the classification meant — that could only ever
 * produce the three outcomes the switch knew about. Most of what the model
 * understood was computed and then discarded at the point of writing, which is
 * what made a capable model feel shallow. Here the model reaches the writes
 * itself, so its understanding and the app's behaviour are the same thing.
 *
 * Never throws. Every outcome, including failure, is recorded on the row: a
 * failure that is not written down is a failure the student is told nothing
 * about, and they drop the item again.
 */
export async function organizeWithAgent(
  captureId: string,
  downloadFile?: DownloadFile,
  options: {
    /** A reply to a question an earlier run asked. */
    studentAnswer?: string;
    /** Wall-clock room this run may take. Defaults to an interactive request's. */
    timeBudgetMs?: number;
  } = {}
): Promise<AgentRunResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    await prisma.captureItem.update({
      where: { id: captureId },
      data: { status: "UNPROCESSED", error: null, analyzedBy: null },
    });
    return { status: "FAILED", actions: [], message: "No AI provider is configured." };
  }

  const selection = {
    id: true,
    userId: true,
    kind: true,
    text: true,
    document: {
      select: {
        id: true,
        originalName: true,
        extractedText: true,
        processingStatus: true,
        mimeType: true,
        storagePath: true,
      },
    },
  } as const;

  let capture = await prisma.captureItem.findUnique({ where: { id: captureId }, select: selection });
  if (!capture) return { status: "FAILED", actions: [], message: "That item no longer exists." };

  // Text extraction happens before the agent is asked anything, for everything
  // except an image — the model reads a picture itself, so running OCR first
  // would be work done to produce a filename it already has.
  const doc = capture.document;
  if (doc && downloadFile && doc.processingStatus === "QUEUED" && !VISION_MIME_TYPES.has(doc.mimeType)) {
    await readFileNow(doc.id, downloadFile);
    capture =
      (await prisma.captureItem.findUnique({ where: { id: captureId }, select: selection })) ?? capture;
  }

  const image = await loadImage(capture.document, downloadFile);
  const content = resolveContent(capture, !!image);
  if (!content.ready) {
    await prisma.captureItem.update({
      where: { id: captureId },
      data: { status: "UNPROCESSED", error: content.reason },
    });
    return { status: "FAILED", actions: [], message: content.reason };
  }

  await prisma.captureItem.update({
    where: { id: captureId },
    data: { status: "ANALYZING", error: null },
  });

  // The agent's world, loaded up front. Handing it the course list and what
  // was dropped recently means the ordinary drop needs no lookup round trip —
  // it can go straight from reading the item to writing the rows, which is
  // most of the difference between this feeling instant and feeling like a
  // pipeline.
  const [subjects, recent] = await Promise.all([
    prisma.subject.findMany({
      where: { userId: capture.userId, status: { not: "ARCHIVED" } },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
      take: 50,
    }),
    prisma.captureItem.findMany({
      where: { id: { not: captureId }, userId: capture.userId, agentSummary: { not: null } },
      select: { agentSummary: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const input: AgentInput = {
    content: content.content,
    fileName: content.fileName,
    image,
    subjects,
    recentActivity: recent.map(
      (r) => `${r.createdAt.toISOString().slice(0, 10)}: ${r.agentSummary ?? ""}`
    ),
    today: new Date().toISOString().slice(0, 10),
    studentAnswer: options.studentAnswer,
  };

  const ctx: AgentContext = { userId: capture.userId, captureId };
  const result = await runAgent(apiKey, ctx, input, options.timeBudgetMs);

  await recordOutcome(captureId, result);
  return result;
}

/**
 * Writes what happened onto the capture row.
 *
 * The status is decided by the actions, not by the model's own account of
 * itself: a run that wrote nothing is never marked organised, however
 * confidently it signed off. ANALYZING is left behind in every branch, so an
 * item can never be stranded mid-run in the inbox.
 */
async function recordOutcome(captureId: string, result: AgentRunResult): Promise<void> {
  const actions = result.actions as unknown as Prisma.InputJsonValue;
  const model = process.env.AI_MODEL?.trim() || "claude-opus-5";

  if (result.status === "DONE") {
    await prisma.captureItem.update({
      where: { id: captureId },
      data: {
        status: "ORGANIZED",
        organizedAt: new Date(),
        agentActions: actions,
        agentSummary: result.summary,
        analyzedBy: `anthropic:${model}`,
        error: null,
      },
    });
    return;
  }

  // A run that was cut off is deliberately *not* marked organised, even though
  // it wrote real things. Organised items leave the inbox, and this one still
  // has work in it — the student needs to be able to hand it back. Running it
  // again is safe: every write tool checks for what it would duplicate before
  // creating anything.
  //
  // `error` is what separates this from a question: both leave the item
  // waiting with something to say, and only one of them is a prompt for the
  // student to answer.
  if (result.status === "PARTIAL") {
    await prisma.captureItem.update({
      where: { id: captureId },
      data: {
        status: "NEEDS_REVIEW",
        agentActions: actions,
        agentSummary: result.reason,
        analyzedBy: `anthropic:${model}`,
        error: result.reason.slice(0, 500),
      },
    });
    return;
  }

  if (result.status === "ASKED") {
    await prisma.captureItem.update({
      where: { id: captureId },
      data: {
        status: "NEEDS_REVIEW",
        agentActions: actions,
        agentSummary: result.question,
        analyzedBy: `anthropic:${model}`,
        error: null,
      },
    });
    return;
  }

  if (result.status === "NOTHING_TO_DO") {
    await prisma.captureItem.update({
      where: { id: captureId },
      data: {
        status: "UNPROCESSED",
        agentActions: actions,
        agentSummary: result.summary,
        analyzedBy: `anthropic:${model}`,
        error: null,
      },
    });
    return;
  }

  await prisma.captureItem.update({
    where: { id: captureId },
    data: {
      status: "FAILED",
      agentActions: actions,
      error: result.message.slice(0, 500),
    },
  });
}

/** What the item actually offers the agent to work from. */
function resolveContent(
  capture: {
    kind: "TEXT" | "FILE";
    text: string | null;
    document: { originalName: string; extractedText: string | null; processingStatus: string } | null;
  },
  hasImage: boolean
): { ready: false; reason: string } | { ready: true; content: string; fileName?: string } {
  if (capture.kind === "TEXT") {
    const content = capture.text?.trim() ?? "";
    if (content.length < MIN_ANALYZABLE_CHARS) return { ready: false, reason: "Too short to work with." };
    return { ready: true, content: content.slice(0, MAX_CONTENT_CHARS) };
  }

  const doc = capture.document;
  if (!doc) return { ready: false, reason: "The file behind this item is gone." };

  // An image the model can decode needs no extracted text: the picture is the
  // content, and waiting for a text-extraction pass that will never produce
  // anything is how a screenshot ends up permanently "still being read".
  if (hasImage) return { ready: true, content: doc.originalName, fileName: doc.originalName };

  if (doc.processingStatus === "PROCESSING") return { ready: false, reason: "Still reading the file." };

  const extracted = doc.extractedText?.trim() ?? "";
  if (extracted.length < MIN_ANALYZABLE_CHARS) {
    return { ready: false, reason: "No text could be read from this file." };
  }

  return { ready: true, content: extracted.slice(0, MAX_CONTENT_CHARS), fileName: doc.originalName };
}
