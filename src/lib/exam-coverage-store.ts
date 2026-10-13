/**
 * The next exam of a course, and how much of what it covers has been read.
 *
 * Reads only. The judgement about what an exam covers lives in
 * src/lib/exam-coverage.ts with its own checks; this is the part that cannot
 * be tested without a database — which rows feed it.
 */

import { prisma } from "@/lib/prisma";
import { coverageOf, coveredBy, type Coverage } from "@/lib/exam-coverage";

export interface NextExam {
  id: string;
  title: string;
  date: Date;
  /* No `weight`: `Task` has no such column, and the percentage lives inside
     the title the importer wrote — "Final OSPE — Clinical Leadership and
     Management (40%)". Adding a column and leaving it null everywhere would
     be a field that lies by being empty. */
  coverage: Coverage;
}

/**
 * The soonest exam or quiz for a course, with its coverage.
 *
 * ONLY EXAMS AND QUIZZES, the same rule the daily dose uses: an assignment has
 * its own deadline and does not mean "revise the course". Keeping the two
 * screens on one rule is the point — a student told "an exam in 6 days" on one
 * screen and shown a different exam on another stops believing both.
 */
export async function nextExamFor(
  subjectId: string,
  userId: string,
  now: Date
): Promise<NextExam | null> {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const exam = await prisma.task.findFirst({
    where: {
      userId,
      subjectId,
      type: { in: ["EXAM", "QUIZ"] },
      status: { not: "COMPLETED" },
      deadline: { gte: start },
    },
    select: { id: true, title: true, deadline: true },
    orderBy: { deadline: "asc" },
  });
  if (!exam?.deadline) return null;

  const lectures = await prisma.lecture.findMany({
    where: { subjectId, subject: { userId } },
    select: {
      id: true,
      title: true,
      date: true,
      status: true,
      subjectId: true,
      sections: {
        select: { progress: { where: { userId }, select: { studiedAt: true }, take: 1 } },
      },
    },
    orderBy: { date: "asc" },
  });

  const covered = coveredBy(lectures, { subjectId, date: exam.deadline });

  return {
    id: exam.id,
    title: exam.title,
    date: exam.deadline,
    coverage: coverageOf(
      covered.map((l) => ({
        id: l.id,
        title: l.title,
        topics:
          l.sections.length === 0
            ? null
            : {
                total: l.sections.length,
                done: l.sections.filter((s) => s.progress.length > 0).length,
              },
        studied: l.status === "COMPLETED",
      }))
    ),
  };
}
