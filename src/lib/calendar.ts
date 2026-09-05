import { prisma } from "@/lib/prisma";

export type CalendarEventType = "TASK" | "STUDY" | "CLINICAL" | "REVIEW";

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
};

export async function getCalendarEvents(userId: string, start: Date, end: Date): Promise<CalendarEvent[]> {
  const [tasks, sessions, clinical, reviews] = await Promise.all([
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

  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
