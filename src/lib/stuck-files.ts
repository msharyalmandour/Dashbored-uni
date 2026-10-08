import { prisma } from "@/lib/prisma";

/**
 * FILES THAT NEVER LANDED.
 *
 * The inbox is gone from the sidebar, and its one genuinely urgent fact had to
 * go somewhere rather than go away. Measured on this account on 2026-10-08:
 * 17 dropped items, of which
 *
 *   FAILED        9    Cardiac monitor_ES.pdf, ETT suctioning_ES.pdf,
 *                      Gas Exchange and Respiratory Function…, the NURC 411
 *                      syllabus, the ORGANIZING deck
 *   UNPROCESSED   2    filed, but no AI provider was configured to read them
 *   NEEDS_REVIEW  1    read, waiting for the student to confirm
 *
 * which matters because of what is NOT in the app: `Revascular system` and
 * `ECG` have no file at all, and the midterm that covers them is four days
 * away. Some of those nine failures are very probably the missing material.
 *
 * A student should be TOLD a file did not land. Making them visit a page to
 * find out is how twelve files sit for a month — the inbox was not ignored
 * because it was hidden, it was ignored because nothing ever asked for it.
 *
 * ORGANIZED and PENDING and ANALYZING are deliberately not counted: one is
 * finished and the other two are in flight, and a number that goes up while
 * the system is working correctly is a number people learn to ignore.
 */
export const STUCK = ["FAILED", "UNPROCESSED", "NEEDS_REVIEW"] as const;

export interface StuckFiles {
  /** How many are waiting. Zero means the band draws nothing at all. */
  count: number;
  /** Broken down, because "retry" and "confirm" are different actions. */
  failed: number;
  needsReview: number;
  unprocessed: number;
}

export async function getStuckFiles(userId: string): Promise<StuckFiles> {
  const rows = await prisma.captureItem.groupBy({
    by: ["status"],
    where: { userId, status: { in: [...STUCK] } },
    _count: { _all: true },
  });

  const of = (status: (typeof STUCK)[number]) =>
    rows.find((r) => r.status === status)?._count._all ?? 0;

  const failed = of("FAILED");
  const needsReview = of("NEEDS_REVIEW");
  const unprocessed = of("UNPROCESSED");
  return { count: failed + needsReview + unprocessed, failed, needsReview, unprocessed };
}
