import { prisma } from "@/lib/prisma";
import { startOfDay, subDays, format, startOfWeek, subWeeks, addWeeks } from "date-fns";

export async function getStudyTimeSeries(userId: string, days = 14) {
  const start = startOfDay(subDays(new Date(), days - 1));
  const sessions = await prisma.focusSession.findMany({
    where: { userId, status: "COMPLETED", startedAt: { gte: start } },
    select: { startedAt: true, actualMinutes: true },
  });

  const byDay = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = subDays(new Date(), days - 1 - i);
    byDay.set(format(d, "yyyy-MM-dd"), 0);
  }
  for (const s of sessions) {
    const key = format(s.startedAt, "yyyy-MM-dd");
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + (s.actualMinutes ?? 0));
  }

  return Array.from(byDay.entries()).map(([date, minutes]) => ({
    date,
    label: format(new Date(date), "EEE d"),
    minutes,
  }));
}

export async function getConsistencyGrid(userId: string, weeks = 12) {
  const start = startOfWeek(subWeeks(new Date(), weeks - 1));
  const sessions = await prisma.focusSession.findMany({
    where: { userId, status: "COMPLETED", startedAt: { gte: start } },
    select: { startedAt: true, actualMinutes: true },
  });

  const byDay = new Map<string, number>();
  for (const s of sessions) {
    const key = format(s.startedAt, "yyyy-MM-dd");
    byDay.set(key, (byDay.get(key) ?? 0) + (s.actualMinutes ?? 0));
  }

  const gridWeeks: { date: string; minutes: number }[][] = [];
  for (let w = 0; w < weeks; w++) {
    const weekStart = addWeeks(start, w);
    const week: { date: string; minutes: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(weekStart);
      day.setDate(day.getDate() + d);
      const key = format(day, "yyyy-MM-dd");
      week.push({ date: key, minutes: byDay.get(key) ?? 0 });
    }
    gridWeeks.push(week);
  }
  return gridWeeks;
}

export async function getSubjectCompletion(userId: string) {
  const subjects = await prisma.subject.findMany({
    where: { userId },
    include: { lectures: { select: { completionPercentage: true } } },
    orderBy: { name: "asc" },
  });
  return subjects.map((s) => ({
    name: s.name,
    color: s.color,
    completion:
      s.lectures.length > 0
        ? Math.round(s.lectures.reduce((sum, l) => sum + l.completionPercentage, 0) / s.lectures.length)
        : 0,
  }));
}

export async function getStudyProgress(userId: string, weeks = 10) {
  const totalLectures = await prisma.lecture.count({ where: { subject: { userId } } });
  const start = startOfWeek(subWeeks(new Date(), weeks - 1));

  const points: { label: string; percent: number }[] = [];
  for (let w = 0; w < weeks; w++) {
    const weekEnd = addWeeks(start, w + 1);
    const completedByThen = await prisma.lecture.count({
      where: { subject: { userId }, status: "COMPLETED", updatedAt: { lte: weekEnd } },
    });
    points.push({
      label: format(addWeeks(start, w), "MMM d"),
      percent: totalLectures > 0 ? Math.round((completedByThen / totalLectures) * 100) : 0,
    });
  }
  return points;
}

export async function getGapTrends(userId: string, weeks = 8) {
  const start = startOfWeek(subWeeks(new Date(), weeks - 1));
  const gaps = await prisma.knowledgeGap.findMany({
    where: { subject: { userId } },
    select: { createdAt: true, resolvedAt: true },
  });

  const points: { label: string; created: number; resolved: number }[] = [];
  for (let w = 0; w < weeks; w++) {
    const weekStart = addWeeks(start, w);
    const weekEnd = addWeeks(start, w + 1);
    points.push({
      label: format(weekStart, "MMM d"),
      created: gaps.filter((g) => g.createdAt >= weekStart && g.createdAt < weekEnd).length,
      resolved: gaps.filter((g) => g.resolvedAt && g.resolvedAt >= weekStart && g.resolvedAt < weekEnd).length,
    });
  }
  return points;
}

export async function getPracticeAccuracy(userId: string) {
  const subjects = await prisma.subject.findMany({
    where: { userId },
    include: { problems: { where: { status: { in: ["CORRECT", "INCORRECT"] } } } },
    orderBy: { name: "asc" },
  });
  return subjects
    .filter((s) => s.problems.length > 0)
    .map((s) => ({
      name: s.name,
      color: s.color,
      accuracy: Math.round(
        (s.problems.filter((p) => p.status === "CORRECT").length / s.problems.length) * 100
      ),
    }));
}

export async function getRepeatedMistakes(userId: string, limit = 6) {
  const mistakes = await prisma.mistake.findMany({
    where: { userId, status: { not: "RESOLVED" } },
    include: { topic: true, subject: true },
  });
  const byTopic = new Map<string, { name: string; count: number }>();
  for (const m of mistakes) {
    const key = m.topicId ?? m.subjectId;
    const name = m.topic?.name ?? m.subject.name;
    const existing = byTopic.get(key);
    if (existing) existing.count += 1;
    else byTopic.set(key, { name, count: 1 });
  }
  return Array.from(byTopic.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function getReviewCompletion(userId: string, weeks = 6) {
  const start = startOfWeek(subWeeks(new Date(), weeks - 1));
  const items = await prisma.reviewItem.findMany({
    where: { userId, scheduledDate: { gte: start } },
    select: { scheduledDate: true, status: true },
  });

  const points: { label: string; completed: number; overdue: number }[] = [];
  const now = new Date();
  for (let w = 0; w < weeks; w++) {
    const weekStart = addWeeks(start, w);
    const weekEnd = addWeeks(start, w + 1);
    const inWeek = items.filter((i) => i.scheduledDate >= weekStart && i.scheduledDate < weekEnd);
    points.push({
      label: format(weekStart, "MMM d"),
      completed: inWeek.filter((i) => i.status === "COMPLETED").length,
      overdue: inWeek.filter((i) => i.status !== "COMPLETED" && i.scheduledDate < now).length,
    });
  }
  return points;
}

export async function getFlashcardAccuracy(userId: string) {
  const subjects = await prisma.subject.findMany({
    where: { userId },
    include: { flashcards: { where: { reviewCount: { gt: 0 } } } },
    orderBy: { name: "asc" },
  });
  return subjects
    .filter((s) => s.flashcards.length > 0)
    .map((s) => {
      const correct = s.flashcards.reduce((sum, f) => sum + f.correctCount, 0);
      const total = s.flashcards.reduce((sum, f) => sum + f.correctCount + f.incorrectCount, 0);
      return {
        name: s.name,
        color: s.color,
        accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
      };
    });
}
