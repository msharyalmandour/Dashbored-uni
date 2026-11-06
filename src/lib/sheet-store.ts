/**
 * Everything the شيت screen draws, read once.
 *
 * NO STRINGS COME OUT OF HERE, and no judgements either: the counting and the
 * time arithmetic are in src/lib/sheet.ts with their own guard, and this is
 * only ever "which rows".
 *
 * THE BREADCRUMB IS REAL OR IT IS ABSENT. The reference asks for
 * «أسبوعي › الأحد 8 › القيادة السريرية › الشيت 9». The first two of those are
 * only true when the sheet's course actually has a timetable row, so the trail
 * is built from `TimeCommitment` and simply stops where the data stops. A
 * breadcrumb that says "الأحد 8" about a course with no Sunday class is a lie
 * drawn in small grey type, which is the easiest kind to leave in.
 */

import { prisma } from "@/lib/prisma";
import { worldFor, type World } from "@/lib/world";
import { courseCode, nameWithoutCode } from "@/lib/course-code";
import type { TutorSource } from "@/lib/sheet-tutor";

export interface SheetQuestionRow {
  id: string;
  orderIndex: number;
  prompt: string;
  answer: string | null;
  answeredAt: Date | null;
}

export interface SheetScreen {
  id: string;
  title: string;
  /** "الشيت 9" — the number the course calls it by, or null. */
  number: number | null;
  criteria: string | null;
  course: { id: string; name: string; code: string | null; world: World };
  /** From the Task this sheet was handed out as. Null when it has none. */
  deadline: Date | null;
  taskId: string | null;
  /** The weekday and start minute of the course's class, for the breadcrumb. */
  fromClass: { weekday: number; startMinute: number } | null;
  questions: SheetQuestionRow[];
  /** The course's own lectures, for the tutor's examples. */
  sources: TutorSource[];
}

export async function loadSheet(userId: string, sheetId: string): Promise<SheetScreen | null> {
  const sheet = await prisma.sheet.findFirst({
    where: { id: sheetId, userId },
    select: {
      id: true,
      title: true,
      number: true,
      criteria: true,
      taskId: true,
      subject: { select: { id: true, name: true, code: true, createdAt: true } },
      task: { select: { id: true, deadline: true } },
      questions: {
        orderBy: { orderIndex: "asc" },
        select: { id: true, orderIndex: true, prompt: true, answer: true, answeredAt: true },
      },
    },
  });
  if (!sheet) return null;

  const [slot, lectures, position] = await Promise.all([
    /* The earliest class of this course in the week, which is the one the
       breadcrumb means by "جاي من جدولك". */
    prisma.timeCommitment.findFirst({
      where: { userId, subjectId: sheet.subject.id, weekday: { not: null } },
      orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
      select: { weekday: true, startMinute: true },
    }),
    prisma.lecture.findMany({
      where: { subjectId: sheet.subject.id },
      orderBy: { lectureNumber: "asc" },
      select: { title: true, sections: { select: { title: true }, orderBy: { position: "asc" } } },
    }),
    /* Creation order among this student's courses, which is what `worldFor`
       takes as a position for a course it does not know by code. */
    prisma.subject
      .count({ where: { userId, createdAt: { lt: sheet.subject.createdAt } } }),
  ]);

  return {
    id: sheet.id,
    title: sheet.title,
    number: sheet.number,
    criteria: sheet.criteria,
    course: {
      id: sheet.subject.id,
      name: nameWithoutCode(sheet.subject.name, sheet.subject.code),
      code: courseCode(sheet.subject.name, sheet.subject.code),
      world: worldFor(sheet.subject, position),
    },
    deadline: sheet.task?.deadline ?? null,
    taskId: sheet.taskId,
    fromClass:
      slot && slot.weekday !== null
        ? { weekday: slot.weekday, startMinute: slot.startMinute }
        : null,
    questions: sheet.questions,
    sources: lectures.map((l) => ({
      title: l.title,
      sections: l.sections.map((section) => section.title),
    })),
  };
}

/**
 * Save one answer.
 *
 * `answeredAt` MOVES ONLY WHEN THE TEXT CHANGES. The editor saves every two
 * seconds while he types, and a save that wrote the same string would push
 * the timestamp forward on every tick — so "انحفظ تلقائيًا قبل دقيقة" would
 * read "الحين" forever, including an hour after he stopped. The screen's one
 * claim about saving has to be about his writing, not about the polling.
 */
export async function saveAnswer(
  userId: string,
  questionId: string,
  answer: string
): Promise<{ saved: boolean; answeredAt: Date | null }> {
  const current = await prisma.sheetQuestion.findFirst({
    where: { id: questionId, sheet: { userId } },
    select: { id: true, answer: true, answeredAt: true },
  });
  if (!current) return { saved: false, answeredAt: null };
  if (current.answer === answer) return { saved: true, answeredAt: current.answeredAt };

  const updated = await prisma.sheetQuestion.update({
    where: { id: current.id },
    data: { answer, answeredAt: new Date() },
    select: { answeredAt: true },
  });
  return { saved: true, answeredAt: updated.answeredAt };
}
