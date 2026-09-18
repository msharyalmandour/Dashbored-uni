"use server";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";
import { advance, clampPage, type Position } from "@/lib/study-position";

/**
 * Record where the student is in a document.
 *
 * Called as they page through, debounced — see POSITION_SAVE_DELAY_MS. The row
 * is an upsert on (userId, slideId), so the last write wins and two tabs racing
 * resolve in the database rather than quietly creating a second position.
 *
 * Ownership is checked the way every action here checks it: the deck must
 * belong to this student, through lecture -> subject -> userId. Without that,
 * anyone with a slide id could write a position into somebody else's account —
 * and, since the position drives Studio, put a stranger's lecture on their
 * home screen.
 *
 * Deliberately silent on failure. This is called from a background timer while
 * the student is reading; a dropped save costs them a few slides of position
 * and nothing else, and surfacing it would interrupt reading to report the
 * unimportant.
 */
export async function recordPosition(slideId: string, page: number) {
  const userId = await requireUserId();

  const slide = await prisma.lectureSlide.findFirst({
    where: { id: slideId, lecture: { subject: { userId } } },
    select: { id: true, pageCount: true },
  });
  if (!slide) return;

  const existing = await prisma.studyPosition.findUnique({
    where: { userId_slideId: { userId, slideId } },
    select: { lastPage: true, furthestPage: true, lastViewedAt: true, completedAt: true },
  });

  /* The arithmetic lives in src/lib/study-position.ts and is asserted by
     scripts/verify-study-position.ts — how far someone has been is not the
     same as where they are, and getting that wrong silently tells a student
     they are further behind than they are. */
  const next: Position = advance(existing, page, slide.pageCount, new Date());

  await prisma.studyPosition.upsert({
    where: { userId_slideId: { userId, slideId } },
    create: {
      userId,
      slideId,
      lastPage: next.lastPage,
      furthestPage: next.furthestPage,
      lastViewedAt: next.lastViewedAt,
      completedAt: next.completedAt,
    },
    update: {
      lastPage: next.lastPage,
      furthestPage: next.furthestPage,
      lastViewedAt: next.lastViewedAt,
      completedAt: next.completedAt,
    },
  });
}

/**
 * Forget where the student was in a document.
 *
 * The "start from the beginning" escape hatch. A deck they have decided to
 * re-read from scratch should stop being offered as something to continue, and
 * the honest way to do that is to remove the position rather than to write a
 * fake one at page one.
 */
export async function clearPosition(slideId: string) {
  const userId = await requireUserId();
  await prisma.studyPosition.deleteMany({ where: { userId, slideId } });
}

/**
 * Where a document should open.
 *
 * Read on the server so the first paint is already on the right page: resolving
 * it in the browser would render page one and then jump, which reads as a bug
 * even when it lands on the correct slide.
 */
export async function getResumePage(slideId: string): Promise<number> {
  const userId = await requireUserId();
  const row = await prisma.studyPosition.findUnique({
    where: { userId_slideId: { userId, slideId } },
    select: { lastPage: true, completedAt: true, slide: { select: { pageCount: true } } },
  });
  if (!row || row.completedAt) return 1;
  return clampPage(row.lastPage, row.slide.pageCount);
}
