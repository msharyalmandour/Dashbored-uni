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

/**
 * How large a PDF may be before it is no longer sent whole.
 *
 * The API's ceiling is a 32MB request, but base64 inflates bytes by a third
 * and the rest of the request has to fit too, so this stays well under it. A
 * PDF above this falls back to text extraction, which is the worse answer and
 * still an answer.
 */
const MAX_PDF_BYTES = 20_000_000;

/** How much of a long document is sent. The first pages carry the signal. */
const MAX_CONTENT_CHARS = 30_000;

/**
 * The budgets the one PDF retry is held to.
 *
 * `DEFAULT_RETRY_BUDGET_MS` only stands in when the caller named no budget of
 * its own, and matches the interactive default the loop uses. The minimum is
 * there so a retry is never started with seconds left — a second run cut off
 * mid-write is worse than the first failure, which at least had a reason.
 */
const DEFAULT_RETRY_BUDGET_MS = 95_000;
const MIN_RETRY_BUDGET_MS = 20_000;

/**
 * Whether the one text-only retry is worth starting, and with how long.
 *
 * Pulled out as a function of nothing but its arguments because it is the part
 * that can be wrong without anything looking wrong: retry when rows were
 * already written and the student gets duplicates, retry with four seconds
 * left and a half-finished second run replaces a failure that at least had a
 * reason. Both are silent in a way a dropped file never is, so both are
 * tested.
 */
export function planPdfRetry(state: {
  /** Whether the failed run sent the PDF itself. Nothing to fall back from if not. */
  sentPdf: boolean;
  status: AgentRunResult["status"];
  /** How much the failed run already wrote. Anything above zero is not a retry. */
  actionCount: number;
  /** Whether the bytes can be fetched again to extract text from. */
  canReadFile: boolean;
  elapsedMs: number;
  budgetMs?: number;
}): { retry: false } | { retry: true; remainingMs: number } {
  if (!state.sentPdf || !state.canReadFile) return { retry: false };
  if (state.status !== "FAILED" || state.actionCount > 0) return { retry: false };

  const remainingMs = (state.budgetMs ?? DEFAULT_RETRY_BUDGET_MS) - state.elapsedMs;
  return remainingMs > MIN_RETRY_BUDGET_MS ? { retry: true, remainingMs } : { retry: false };
}

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

/** Whether this file is a PDF, by what it says it is or what it is called. */
function isPdf(document: { mimeType: string; originalName: string }): boolean {
  return (
    document.mimeType.toLowerCase() === "application/pdf" ||
    document.originalName.toLowerCase().endsWith(".pdf")
  );
}

/**
 * The PDF itself, when the item is one small enough to send.
 *
 * A lecture PDF used to reach the model as whatever pdfjs managed to scrape
 * out of it — and in the deployed build that was nothing at all, because the
 * bundler rewrote the worker's path to a file nothing ever wrote, so *every*
 * PDF a student dropped came back "No text could be read from this file."
 * Fixing the bundling would have restored a layer that was never the right
 * one anyway: extracted text loses the columns, the tables and the slide
 * structure that tell a timetable from a syllabus, and a scanned handout has
 * no text layer to lose in the first place.
 *
 * So the PDF goes to the model whole, the same way a photograph does. There
 * is no extraction step left to fail.
 */
async function loadPdf(
  document: { mimeType: string; originalName: string; storagePath: string } | null,
  downloadFile?: DownloadFile
): Promise<{ base64: string } | undefined> {
  if (!document || !downloadFile) return undefined;
  if (!isPdf(document)) return undefined;

  const bytes = await downloadFile(document.storagePath).catch(() => null);
  if (!bytes || bytes.byteLength > MAX_PDF_BYTES) return undefined;

  return { base64: bytes.toString("base64") };
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

  // The two kinds of file the model reads for itself — a picture and a PDF —
  // are fetched first, because whether that succeeded decides whether there is
  // any point extracting text at all.
  const doc = capture.document;
  const pdf = await loadPdf(doc, downloadFile);

  // Text extraction happens before the agent is asked anything, for everything
  // the model cannot read directly. Running it for those would be work done to
  // produce a filename the model already has — and, for a PDF, a worse copy of
  // something it is about to be handed in full.
  //
  // The document row is deliberately left QUEUED when the PDF was sent whole:
  // the student's answer does not depend on extraction any more, but the
  // Library's search still wants the text, and the nightly pass can take its
  // time getting it.
  const readable = pdf || (doc && VISION_MIME_TYPES.has(doc.mimeType));
  if (doc && downloadFile && !readable && doc.processingStatus === "QUEUED") {
    await readFileNow(doc.id, downloadFile);
    capture =
      (await prisma.captureItem.findUnique({ where: { id: captureId }, select: selection })) ?? capture;
  }

  const image = await loadImage(capture.document, downloadFile);
  const content = resolveContent(capture, !!image || !!pdf);
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
    pdf,
    subjects,
    recentActivity: recent.map(
      (r) => `${r.createdAt.toISOString().slice(0, 10)}: ${r.agentSummary ?? ""}`
    ),
    today: new Date().toISOString().slice(0, 10),
    studentAnswer: options.studentAnswer,
  };

  const ctx: AgentContext = { userId: capture.userId, captureId };
  const startedAt = Date.now();
  let result = await runAgent(apiKey, ctx, input, options.timeBudgetMs);

  // A PDF the provider itself refuses — encrypted, past its page ceiling,
  // written by something that produced a file only its own reader accepts —
  // fails the whole request before the model sees a word of it. The student
  // did nothing wrong and would be shown a sentence about the API, so the
  // older, weaker route is tried once: extract what text there is and ask
  // again without the file attached. Only when nothing was written, because a
  // second run over rows that already exist is not a retry.
  const retry = planPdfRetry({
    sentPdf: !!pdf,
    status: result.status,
    actionCount: result.actions.length,
    canReadFile: !!doc && !!downloadFile,
    elapsedMs: Date.now() - startedAt,
    budgetMs: options.timeBudgetMs,
  });

  if (retry.retry && doc && downloadFile) {
    await readFileNow(doc.id, downloadFile);
    const reread = await prisma.captureItem.findUnique({ where: { id: captureId }, select: selection });
    const fallback = reread ? resolveContent(reread, false) : { ready: false as const, reason: "" };
    if (fallback.ready) {
      result = await runAgent(
        apiKey,
        ctx,
        { ...input, content: fallback.content, fileName: fallback.fileName, pdf: undefined },
        retry.remainingMs
      );
    }
  }

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
  modelReadsFile: boolean
): { ready: false; reason: string } | { ready: true; content: string; fileName?: string } {
  if (capture.kind === "TEXT") {
    const content = capture.text?.trim() ?? "";
    if (content.length < MIN_ANALYZABLE_CHARS) return { ready: false, reason: "Too short to work with." };
    return { ready: true, content: content.slice(0, MAX_CONTENT_CHARS) };
  }

  const doc = capture.document;
  if (!doc) return { ready: false, reason: "The file behind this item is gone." };

  // A file the model reads itself — a picture, or a PDF sent whole — needs no
  // extracted text: the file is the content, and waiting for a text-extraction
  // pass that will never produce anything is how a screenshot ends up
  // permanently "still being read", and how every PDF ended up refused.
  if (modelReadsFile) return { ready: true, content: doc.originalName, fileName: doc.originalName };

  if (doc.processingStatus === "PROCESSING") return { ready: false, reason: "Still reading the file." };

  const extracted = doc.extractedText?.trim() ?? "";
  if (extracted.length < MIN_ANALYZABLE_CHARS) {
    return { ready: false, reason: "No text could be read from this file." };
  }

  return { ready: true, content: extracted.slice(0, MAX_CONTENT_CHARS), fileName: doc.originalName };
}
