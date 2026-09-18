import { prisma } from "@/lib/prisma";
import { parseStoredAnalysis } from "@/lib/ai/types";
import { parseStoredActions } from "@/lib/ai/agent/types";
import { parseReviewNotes } from "@/lib/ai/agent/organize";
import type { ReviewFinding } from "@/lib/ai/agent/review";
import { parsePendingWrites, type PendingTimetable } from "@/lib/ai/agent/pending";
import type { AgentAction } from "@/lib/ai/agent/types";
import type { CaptureAnalysis } from "@/lib/ai/types";
import type { CaptureKind, CaptureStatus } from "@prisma/client";

export interface InboxItem {
  id: string;
  kind: CaptureKind;
  status: CaptureStatus;
  text: string | null;
  fileName: string | null;
  mimeType: string | null;
  /** The Document's own lifecycle — a file can still be being read. */
  documentStatus: string | null;
  /** Real, counted by the PDF processor — never asked of the model. */
  pageCount: number | null;
  /**
   * The proposal shape the old two-stage flow produced. Kept because rows
   * organised before the agent existed still carry one, and dropping it would
   * blank the title on everything already in someone's history.
   */
  analysis: CaptureAnalysis | null;
  /** What the agent actually did, with the real id of every row it created. */
  agentActions: AgentAction[];
  /**
   * The agent's closing sentence — or, on an item still waiting, the question
   * it asked. Reading it from the row is what lets a question survive a reload
   * rather than living only in the component that received it.
   */
  agentSummary: string | null;

  /** What reading the written rows back turned up, if the review ran. */
  reviewNotes: ReviewFinding[];

  /** A week read but not written, waiting for the student to confirm it. */
  pendingTimetable: PendingTimetable | null;
  analyzedBy: string | null;
  error: string | null;
  createdAt: Date;
}

/**
 * Everything still awaiting a decision, newest first, plus a short tail of what
 * was recently filed.
 *
 * Filed items are kept visible rather than disappearing on confirm: seeing the
 * last few things you sorted is what makes the inbox feel like it is emptying
 * rather than swallowing your work.
 */
export async function getInbox(userId: string): Promise<{ waiting: InboxItem[]; filed: InboxItem[] }> {
  const rows = await prisma.captureItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true,
      kind: true,
      status: true,
      text: true,
      analysis: true,
      agentActions: true,
      agentSummary: true,
      reviewNotes: true,
      pendingWrites: true,
      analyzedBy: true,
      error: true,
      createdAt: true,
      document: {
        select: { originalName: true, mimeType: true, processingStatus: true, pageCount: true },
      },
    },
  });

  const items: InboxItem[] = rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    status: row.status,
    text: row.text,
    fileName: row.document?.originalName ?? null,
    mimeType: row.document?.mimeType ?? null,
    documentStatus: row.document?.processingStatus ?? null,
    pageCount: row.document?.pageCount ?? null,
    analysis: parseStoredAnalysis(row.analysis),
    agentActions: parseStoredActions(row.agentActions),
    agentSummary: row.agentSummary,
    reviewNotes: parseReviewNotes(row.reviewNotes),
    pendingTimetable: parsePendingWrites(row.pendingWrites),
    analyzedBy: row.analyzedBy,
    error: row.error,
    createdAt: row.createdAt,
  }));

  return {
    waiting: items.filter((i) => i.status !== "ORGANIZED"),
    filed: items.filter((i) => i.status === "ORGANIZED").slice(0, 5),
  };
}

/** The count the dashboard shows. Cheap enough to run alongside everything else. */
export function countWaitingCaptures(userId: string) {
  return prisma.captureItem.count({
    where: { userId, status: { not: "ORGANIZED" } },
  });
}
