/**
 * Everything the مشروع screen draws, read once.
 *
 * A PROJECT IS A TASK. There is no Project table and deliberately so: the row
 * that holds "Problem-Solving Project submission (group, 10%)", its deadline
 * and its completion already exists as a Task of type PROJECT, and a second
 * model would be a second answer to "when is it due". The milestones and the
 * group hang off it.
 *
 * NO STRINGS, NO JUDGEMENTS. The progress rule and the current-step rule are
 * in src/lib/project.ts with their own guard.
 */

import { prisma } from "@/lib/prisma";
import { worldFor, type World } from "@/lib/world";
import { courseCode, nameWithoutCode } from "@/lib/course-code";
import { weightFromTitle } from "@/lib/exam-weight";
import type { Milestone } from "@/lib/project";

export interface ProjectMemberRow {
  id: string;
  name: string;
  role: string | null;
  workingOn: string | null;
}

export interface ProjectFile {
  id: string;
  title: string;
}

export interface ProjectScreen {
  id: string;
  title: string;
  deadline: Date;
  /** The typed percentage. Used only when there are no milestones. */
  typedPercent: number;
  /** Read off the title — "(group, 10%)" — or null when it does not say. */
  weight: number | null;
  course: { id: string; name: string; code: string | null; world: World } | null;
  milestones: Milestone[];
  team: ProjectMemberRow[];
  /** The course's next class, which is when the group is in the same room. */
  nextMeeting: { weekday: number; startMinute: number } | null;
  files: ProjectFile[];
}

export async function loadProject(
  userId: string,
  taskId: string
): Promise<ProjectScreen | null> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId },
    select: {
      id: true,
      title: true,
      deadline: true,
      completionPercentage: true,
      subject: { select: { id: true, name: true, code: true, createdAt: true } },
      milestones: {
        orderBy: { orderIndex: "asc" },
        select: { id: true, orderIndex: true, title: true, doneAt: true },
      },
      team: {
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, role: true, workingOn: true },
      },
    },
  });
  if (!task) return null;

  const subject = task.subject;
  const [slot, position, files] = await Promise.all([
    subject
      ? prisma.timeCommitment.findFirst({
          where: { userId, subjectId: subject.id, weekday: { not: null } },
          orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
          select: { weekday: true, startMinute: true },
        })
      : Promise.resolve(null),
    subject
      ? prisma.subject.count({ where: { userId, createdAt: { lt: subject.createdAt } } })
      : Promise.resolve(0),
    /* The course's documents. There is no file-to-task link in this schema,
       so these are the COURSE's files and the screen says so — labelling
       them "the project's files" would be the app claiming a connection
       nothing in the data makes. */
    subject
      ? prisma.document.findMany({
          where: { subjectId: subject.id },
          orderBy: { createdAt: "desc" },
          take: 6,
          select: { id: true, originalName: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    id: task.id,
    title: task.title,
    deadline: task.deadline,
    typedPercent: task.completionPercentage,
    weight: weightFromTitle(task.title),
    course: subject
      ? {
          id: subject.id,
          name: nameWithoutCode(subject.name, subject.code),
          code: courseCode(subject.name, subject.code),
          world: worldFor(subject, position),
        }
      : null,
    milestones: task.milestones,
    team: task.team,
    nextMeeting:
      slot && slot.weekday !== null
        ? { weekday: slot.weekday, startMinute: slot.startMinute }
        : null,
    files: files.map((f) => ({ id: f.id, title: f.originalName })),
  };
}
