import { prisma } from "@/lib/prisma";
import { buildWeekMap, type WeekMap } from "@/lib/week-map";

/**
 * Fetches the four tables a week is made of and hands them to the engine.
 *
 * The calendar's own `getCalendarEvents` flattens everything to a point with a
 * single date, which is right for a month grid and useless for a timeline: a
 * class that runs 09:00–12:50 has to keep its end or it cannot be drawn as a
 * duration. So this reads the sources directly rather than widening that shape
 * and making the month view pay for it.
 */
export async function loadWeekMap(
  userId: string,
  weekStart: Date,
  reviewLabel: string,
  now = new Date()
): Promise<WeekMap> {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [events, commitments, tasks, reviews] = await Promise.all([
    prisma.scheduleEvent.findMany({
      where: { userId, startsAt: { gte: weekStart, lt: weekEnd } },
      select: { id: true, title: true, type: true, startsAt: true, endsAt: true, subjectId: true },
      orderBy: { startsAt: "asc" },
    }),
    // Recurring, so not filtered by date — they repeat into every week.
    prisma.timeCommitment.findMany({
      where: { userId },
      select: { id: true, label: true, kind: true, weekday: true, startMinute: true, endMinute: true, subjectId: true },
    }),
    prisma.task.findMany({
      where: { userId, deadline: { gte: weekStart, lt: weekEnd } },
      select: { id: true, title: true, deadline: true, estimatedMinutes: true, status: true, subjectId: true },
    }),
    prisma.reviewItem.findMany({
      where: { userId, scheduledDate: { gte: weekStart, lt: weekEnd } },
      select: { id: true, scheduledDate: true, status: true, subjectId: true },
    }),
  ]);

  return buildWeekMap({
    weekStart,
    now,
    events: events.map((e) => ({ ...e, type: String(e.type) })),
    commitments: commitments.map((c) => ({ ...c, kind: String(c.kind) })),
    tasks: tasks.map((t) => ({ ...t, status: String(t.status) })),
    reviews: reviews.map((r) => ({ ...r, status: String(r.status) })),
    reviewLabel,
  });
}
