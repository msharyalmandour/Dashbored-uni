import { prisma } from "@/lib/prisma";

/**
 * Takes back everything one drop created, and nothing else.
 *
 * A single drop can create a course, twelve weekly classes, their next dated
 * occurrences, five tasks and forty flashcards. Until this existed the only way
 * back was deleting each row by hand across five different pages — which means
 * that in practice the first wrong drop was permanent, and a student who has
 * learned that a tool's mistakes are permanent stops handing it anything
 * important. Undo is not a convenience here; it is the thing that makes the
 * agent safe to give to someone.
 *
 * What makes it exact is that every row the agent writes carries the id of the
 * capture that produced it, so this is one predicate per table rather than a
 * log that has to be complete and correct to be trusted. Rows the student
 * created themselves have no source capture at all and cannot be selected by
 * any of these queries, however wrong the capture id is.
 *
 * Two things are deliberately never removed:
 *
 *   - **Files.** Undoing the organising is not "delete what I uploaded". The
 *     document stays in the Library, exactly as discarding an inbox item
 *     already leaves it.
 *   - **A course that now has the student's own work in it.** Deleting a
 *     Subject cascades to its lectures, gaps, flashcards and topics. If the
 *     student has added anything to that course since, the course stays and is
 *     reported as kept — losing a week of someone's notes to tidy up an
 *     agent's mistake is a far worse outcome than an extra course they can
 *     rename.
 */
export interface UndoSummary {
  courses: number;
  /** Courses left in place because the student has since put their own work in them. */
  coursesKept: string[];
  classes: number;
  commitments: number;
  tasks: number;
  lectures: number;
  gaps: number;
  flashcards: number;
  mistakes: number;
}

export function undoTotal(summary: UndoSummary): number {
  return (
    summary.courses +
    summary.classes +
    summary.commitments +
    summary.tasks +
    summary.lectures +
    summary.gaps +
    summary.flashcards +
    summary.mistakes
  );
}

/**
 * Deletes what the given capture created for the given student.
 *
 * The order is children before parents, so a course is only ever considered for
 * deletion after the things this same drop put inside it are already gone —
 * otherwise every course the agent created would look "still in use" by its own
 * lectures and never be removable.
 *
 * `userId` is passed separately and is never taken from the capture row: it is
 * the caller's authenticated identity, and it appears in every single query
 * here. A capture id alone must not be enough to delete anything.
 */
export async function undoCaptureWrites(captureId: string, userId: string): Promise<UndoSummary> {
  const own = { sourceCaptureId: captureId };

  // Flashcards and mistakes carry the student's own userId, so they are
  // filtered on it directly. Lectures and gaps have no userId of their own and
  // are reached through the course, which is where ownership lives for them.
  const [flashcards, mistakes, gaps, lectures, tasks, classes, commitments] = await Promise.all([
    prisma.flashcard.deleteMany({ where: { ...own, userId } }),
    prisma.mistake.deleteMany({ where: { ...own, userId } }),
    prisma.knowledgeGap.deleteMany({ where: { ...own, subject: { userId } } }),
    prisma.lecture.deleteMany({ where: { ...own, subject: { userId } } }),
    prisma.task.deleteMany({ where: { ...own, userId } }),
    prisma.scheduleEvent.deleteMany({ where: { ...own, userId } }),
    prisma.timeCommitment.deleteMany({ where: { ...own, userId } }),
  ]);

  // Now the courses, one at a time, because each one needs its own question
  // answered: is there anything left in here that this drop did not put there?
  const candidates = await prisma.subject.findMany({
    where: { ...own, userId },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          lectures: true,
          knowledgeGaps: true,
          flashcards: true,
          tasks: true,
          mistakes: true,
          problems: true,
          videos: true,
          topics: true,
          documents: true,
          focusSessions: true,
        },
      },
    },
  });

  let courses = 0;
  const coursesKept: string[] = [];
  for (const subject of candidates) {
    const remaining = Object.values(subject._count).reduce((sum, n) => sum + n, 0);
    if (remaining > 0) {
      coursesKept.push(subject.name);
      continue;
    }
    // Scoped by userId again rather than by id alone. The list above was
    // already filtered, but a delete is the one place worth being repetitive.
    await prisma.subject.deleteMany({ where: { id: subject.id, userId } });
    courses += 1;
  }

  return {
    courses,
    coursesKept,
    classes: classes.count,
    commitments: commitments.count,
    tasks: tasks.count,
    lectures: lectures.count,
    gaps: gaps.count,
    flashcards: flashcards.count,
    mistakes: mistakes.count,
  };
}
