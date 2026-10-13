/**
 * Reading a lecture's topic breakdown back out of the database.
 *
 * The same seam as src/lib/simulation-store.ts and for the same reason: the
 * rules in lecture-sections.ts know nothing about Prisma, so 17 checks can run
 * against them without a database, and this file is the only place that knows
 * both shapes.
 *
 * It validates on the way OUT as well as in. Rows written before today's rules
 * existed, or edited by hand, produce a breakdown the writer's checks never
 * saw — so the screen is handed the problems alongside the content and decides
 * what to draw, rather than finding out half way down.
 */

import { prisma } from "@/lib/prisma";
import { problemsWith, describeProblem, type Section } from "@/lib/lecture-sections";

export interface StoredSections {
  lectureId: string;
  lectureTitle: string;
  subjectId: string;
  subjectName: string;
  /** The one deck a citation can open, when exactly one owns the lecture. */
  deck: { id: string; pages: number } | null;
  sections: (Section & { id: string; firstSlide: number | null; studied: boolean })[];
  /** Empty when the content is sound. Each entry is in the student's words. */
  problems: string[];
}

export async function loadSections(
  lectureId: string,
  userId: string
): Promise<StoredSections | null> {
  const lecture = await prisma.lecture.findFirst({
    where: { id: lectureId, subject: { userId } },
    select: {
      id: true,
      title: true,
      subjectId: true,
      subject: { select: { name: true } },
      slides: { select: { id: true, pageCount: true }, orderBy: { createdAt: "asc" } },
      sections: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          /* Whether THIS student has marked it studied. A left join rather
             than a second query, and scoped to the user because the sections
             are content: another account reading the same breakdown has its
             own progress. */
          progress: { where: { userId }, select: { studiedAt: true }, take: 1 },
          title: true,
          slides: true,
          firstSlide: true,
          idea: true,
          watch: true,
          starred: true,
          points: {
            orderBy: { position: "asc" },
            select: { heading: true, source: true, note: true, slide: true },
          },
        },
      },
    },
  });
  if (!lecture || lecture.sections.length === 0) return null;

  const only = lecture.slides.length === 1 ? lecture.slides[0] : null;
  const deck = only ? { id: only.id, pages: only.pageCount } : null;

  /* The sections are passed through as they come: every optional field here is
     nullable in the database AND optional in the type, which is exactly the
     shape the rules were taught to accept after the first test run died on
     "Cannot read properties of null". Nothing is normalised on the way past. */
  const sections = lecture.sections.map(({ progress, ...section }) => ({
    ...section,
    studied: progress.length > 0,
  }));

  return {
    lectureId: lecture.id,
    lectureTitle: lecture.title,
    subjectId: lecture.subjectId,
    subjectName: lecture.subject.name,
    deck,
    sections,
    /* NOT checked against `deck.pages`. The deck attached to a lecture is not
       guaranteed to BE the lecture — on this student's own account the
       Management Process lecture carries a 13-page file about ETT suctioning —
       and validating his real slide numbers against the wrong document would
       reject correct content. The numbers are the lecture's own. */
    problems: problemsWith(sections).map(describeProblem),
  };
}

/** Which lectures have a breakdown, for the lecture page's entry row. */
export async function lecturesWithSections(
  lectureIds: string[],
  userId: string
): Promise<Map<string, number>> {
  if (lectureIds.length === 0) return new Map();
  const rows = await prisma.lectureSection.groupBy({
    by: ["lectureId"],
    where: { lectureId: { in: lectureIds }, lecture: { subject: { userId } } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.lectureId, r._count._all]));
}
