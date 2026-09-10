import { prisma } from "@/lib/prisma";

export type CalendarEventType = "TASK" | "STUDY" | "CLINICAL" | "REVIEW" | "CLASS";

export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  title: string;
  date: string; // ISO
  href: string;
  color: string;
}

const TYPE_COLOR: Record<CalendarEventType, string> = {
  TASK: "#ef4444",
  STUDY: "#0ea5e9",
  CLINICAL: "#10b981",
  REVIEW: "#8b5cf6",
  CLASS: "#6366f1",
};

/**
 * Everything the student has on, from every source that puts something on a day.
 *
 * `ScheduleEvent` is the one that was missing, and its absence was invisible
 * for as long as nothing wrote to it. Dropping a timetable created eleven
 * classes, correctly, in a table this function did not read — so the rows were
 * real, the confirmation was true, and the calendar was empty. From the
 * student's side that is indistinguishable from the import having done
 * nothing, which is the worst possible failure for a feature whose whole
 * promise is that a photo becomes your week.
 *
 * The lesson is in the shape of the bug, not the fix: a new writer needs its
 * reader checked, or the write lands somewhere nobody looks.
 */
export async function getCalendarEvents(userId: string, start: Date, end: Date): Promise<CalendarEvent[]> {
  const [tasks, sessions, clinical, reviews, classes] = await Promise.all([
    prisma.task.findMany({
      where: { userId, deadline: { gte: start, lte: end } },
      select: { id: true, title: true, deadline: true, type: true },
    }),
    prisma.focusSession.findMany({
      where: { userId, startedAt: { gte: start, lte: end }, status: "COMPLETED" },
      select: { id: true, taskLabel: true, startedAt: true },
    }),
    prisma.clinicalTraining.findMany({
      where: { userId, date: { gte: start, lte: end } },
      select: { id: true, department: true, hospital: true, date: true },
    }),
    prisma.reviewItem.findMany({
      where: { userId, scheduledDate: { gte: start, lte: end }, status: { in: ["SCHEDULED", "DUE"] } },
      select: { id: true, type: true, scheduledDate: true },
    }),
    prisma.scheduleEvent.findMany({
      where: { userId, startsAt: { gte: start, lte: end } },
      select: { id: true, title: true, type: true, startsAt: true, endsAt: true, location: true },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  const events: CalendarEvent[] = [];

  for (const t of tasks) {
    events.push({
      id: `task-${t.id}`,
      type: "TASK",
      title: t.type === "EXAM" ? `Exam: ${t.title}` : t.title,
      date: t.deadline.toISOString(),
      href: `/tasks?task=${t.id}`,
      color: TYPE_COLOR.TASK,
    });
  }
  for (const s of sessions) {
    events.push({
      id: `study-${s.id}`,
      type: "STUDY",
      title: s.taskLabel ?? "Study session",
      date: s.startedAt.toISOString(),
      href: "/focus",
      color: TYPE_COLOR.STUDY,
    });
  }
  for (const c of clinical) {
    events.push({
      id: `clinical-${c.id}`,
      type: "CLINICAL",
      title: c.department ? `${c.department} rotation` : c.hospital ?? "Clinical training",
      date: c.date.toISOString(),
      href: "/clinical",
      color: TYPE_COLOR.CLINICAL,
    });
  }
  for (const r of reviews) {
    events.push({
      id: `review-${r.id}`,
      type: "REVIEW",
      title: `${r.type.replace("_", " ")} review`,
      date: r.scheduledDate.toISOString(),
      href: "/review",
      color: TYPE_COLOR.REVIEW,
    });
  }
  for (const c of classes) {
    // A class carries a start and an end, unlike everything else here, and the
    // time is most of what the student wants from it: "Critical Care" tells
    // them nothing they don't know, "08:00 Critical Care" tells them the day.
    const start = c.startsAt.toISOString().slice(11, 16);
    events.push({
      id: `class-${c.id}`,
      // A hospital block is a clinical placement whichever table it came from,
      // so it takes the colour the student already reads as clinical.
      type: c.type === "CLINICAL" ? "CLINICAL" : "CLASS",
      title: c.location ? `${start} ${c.title} · ${c.location}` : `${start} ${c.title}`,
      date: c.startsAt.toISOString(),
      href: "/time",
      color: c.type === "CLINICAL" ? TYPE_COLOR.CLINICAL : TYPE_COLOR.CLASS,
    });
  }

  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
