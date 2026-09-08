import { prisma } from "@/lib/prisma";
import { parseStoredAnalysis } from "@/lib/ai/analyze-capture";
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
  analysis: CaptureAnalysis | null;
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
      analyzedBy: true,
      error: true,
      createdAt: true,
      document: { select: { originalName: true, mimeType: true, processingStatus: true } },
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
    analysis: parseStoredAnalysis(row.analysis),
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
