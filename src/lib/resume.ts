import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { continueWith, positionOf, type Deck } from "@/lib/study-position";

export type ResumeTarget = {
  href: string;
  lectureTitle: string;
  subjectName: string;
  lastPage: number;
  pageCount: number;
  /** 0-1, from where they are rather than how far they have ever got. */
  progress: number;
};

/**
 * The one deck worth going back into, or nothing.
 *
 * Extracted because two places now need it and they must not disagree: the
 * hero's primary button promises "continue where you left off", and the band
 * below it names the thing being continued. If those came from two queries
 * they could answer differently — the button sending you to one deck while
 * the card underneath advertised another — and the student would have no way
 * to tell which was right.
 *
 * `cache` makes it one query per request even though both callers ask
 * independently, which is what lets each of them stay a component that can be
 * dropped in or removed without rewiring the page's data fetching.
 *
 * Reads StudyPosition rather than the decks: Studio scans two hundred slides
 * because it lists history and has to show untouched decks too, and Home needs
 * exactly one deck that has actually been read — which is precisely what a
 * position row IS. It lands on the [userId, lastViewedAt] index, so "most
 * recently read" is the ordering rather than a sort after the fact.
 */
export const resumeTarget = cache(async (userId: string): Promise<ResumeTarget | null> => {
  const rows = await prisma.studyPosition.findMany({
    where: { userId, slide: { lecture: { subject: { userId } } } },
    select: {
      lastPage: true,
      furthestPage: true,
      lastViewedAt: true,
      completedAt: true,
      slide: {
        select: {
          id: true,
          pageCount: true,
          lecture: { select: { id: true, title: true, subject: { select: { name: true } } } },
        },
      },
    },
    orderBy: { lastViewedAt: "desc" },
    take: 25,
  });

  const decks: Deck[] = rows.map((r) => ({
    slideId: r.slide.id,
    pageCount: r.slide.pageCount,
    position: {
      lastPage: r.lastPage,
      furthestPage: r.furthestPage,
      lastViewedAt: r.lastViewedAt,
      completedAt: r.completedAt,
    },
  }));

  const next = continueWith(decks);
  if (!next) return null;

  const row = rows.find((r) => r.slide.id === next.slideId);
  /* Defensive rather than theoretical: `continueWith` picks from the decks
     built above, so a miss would mean the two lists had gone out of step. A
     null here costs a band; a non-null assertion would cost a crash on Home. */
  if (!row) return null;

  return {
    href: `/lectures/${row.slide.lecture.id}/slides/${row.slide.id}`,
    lectureTitle: row.slide.lecture.title,
    subjectName: row.slide.lecture.subject.name,
    lastPage: next.position?.lastPage ?? 0,
    pageCount: next.pageCount,
    progress: positionOf(next),
  };
});

/** Just the destination, for the hero's button. */
export async function resumeHrefFor(userId: string): Promise<string | null> {
  return (await resumeTarget(userId))?.href ?? null;
}
