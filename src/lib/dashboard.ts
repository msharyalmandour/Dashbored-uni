import { prisma } from "@/lib/prisma";
import { computeRecommendations } from "@/lib/priority-engine";
import { computeAcademicHealth } from "@/lib/academic-health";

function endOfToday(now = new Date()) {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfToday(now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getDashboardData(userId: string) {
  const now = new Date();
  const todayEnd = endOfToday(now);
  const todayStart = startOfToday(now);

  const [
    recommendations,
    health,
    upcomingTasks,
    reviewsDue,
    gaps,
    flashcardsDueCount,
    tasksCompletedToday,
    tasksDueToday,
    focusMinutesToday,
    user,
  ] = await Promise.all([
    computeRecommendations(userId, 6),
    computeAcademicHealth(userId),
    prisma.task.findMany({
      where: { userId, status: { not: "COMPLETED" } },
      include: { subject: true },
      orderBy: { deadline: "asc" },
      take: 6,
    }),
    prisma.reviewItem.findMany({
      where: { userId, status: { in: ["SCHEDULED", "DUE"] }, scheduledDate: { lte: todayEnd } },
      include: { subject: true, lecture: true, topic: true, flashcard: true, knowledgeGap: true, mistake: true },
      orderBy: { scheduledDate: "asc" },
    }),
    prisma.knowledgeGap.findMany({
      where: { subject: { userId } },
    }),
    prisma.flashcard.count({ where: { userId, nextReviewDate: { lte: now } } }),
    prisma.task.count({
      where: { userId, status: "COMPLETED", updatedAt: { gte: todayStart } },
    }),
    prisma.task.count({
      where: { userId, deadline: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.focusSession.aggregate({
      where: { userId, startedAt: { gte: todayStart }, status: "COMPLETED" },
      _sum: { actualMinutes: true },
    }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);

  const unresolvedGaps = gaps.filter((g) => g.status !== "UNDERSTOOD" && g.status !== "MASTERED");
  const difficultGaps = unresolvedGaps.filter((g) => g.difficulty === "HARD");
  const recentlyResolved = gaps.filter(
    (g) => g.resolvedAt && g.resolvedAt.getTime() > now.getTime() - 7 * 86400000
  );

  return {
    recommendations,
    health,
    upcomingTasks,
    reviewsDue,
    gapsSummary: {
      total: gaps.length,
      unresolved: unresolvedGaps.length,
      difficult: difficultGaps.length,
      recentlyResolved: recentlyResolved.length,
    },
    flashcardsDueCount,
    todayProgress: {
      tasksCompletedToday,
      tasksDueToday,
      focusMinutesToday: focusMinutesToday._sum.actualMinutes ?? 0,
    },
    userName: user?.name ?? "Student",
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
