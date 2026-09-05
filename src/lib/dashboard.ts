import { prisma } from "@/lib/prisma";
import { computeRecommendations } from "@/lib/priority-engine";
import { computeAcademicHealth } from "@/lib/academic-health";
import type { Dictionary } from "@/lib/i18n/dictionaries";

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

export async function getDashboardData(userId: string, dict: Dictionary) {
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
    subjectsPreview,
    recentLecture,
    clinicalAgg,
    latestClinical,
    activeTasksCount,
    nextExam,
  ] = await Promise.all([
    computeRecommendations(userId, 6, dict),
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
    prisma.subject.findMany({
      where: { userId, status: "ACTIVE" },
      include: {
        lectures: { select: { completionPercentage: true } },
        knowledgeGaps: { select: { status: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 4,
    }),
    prisma.lecture.findFirst({
      where: { subject: { userId } },
      orderBy: { updatedAt: "desc" },
      include: { subject: true, slides: { select: { id: true } } },
    }),
    prisma.clinicalTraining.aggregate({
      where: { userId },
      _count: { _all: true },
      _sum: { casesSeen: true },
    }),
    prisma.clinicalTraining.findFirst({ where: { userId }, orderBy: { date: "desc" } }),
    prisma.task.count({ where: { userId, status: { not: "COMPLETED" } } }),
    prisma.task.findFirst({
      where: { userId, type: "EXAM", status: { not: "COMPLETED" }, deadline: { gte: todayStart } },
      orderBy: { deadline: "asc" },
    }),
  ]);

  const unresolvedGaps = gaps.filter((g) => g.status !== "UNDERSTOOD" && g.status !== "MASTERED");
  const difficultGaps = unresolvedGaps.filter((g) => g.difficulty === "HARD");
  const recentlyResolved = gaps.filter(
    (g) => g.resolvedAt && g.resolvedAt.getTime() > now.getTime() - 7 * 86400000
  );

  const subjectWorld = subjectsPreview.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    color: s.color,
    avgCompletion:
      s.lectures.length > 0
        ? s.lectures.reduce((sum, l) => sum + l.completionPercentage, 0) / s.lectures.length
        : 0,
    unresolvedGaps: s.knowledgeGaps.filter((g) => g.status !== "UNDERSTOOD" && g.status !== "MASTERED").length,
  }));

  const lectureWorld = recentLecture
    ? {
        id: recentLecture.id,
        title: recentLecture.title,
        subjectName: recentLecture.subject.name,
        subjectColor: recentLecture.subject.color,
        completionPercentage: recentLecture.completionPercentage,
        slideCount: recentLecture.slides.length,
      }
    : null;

  const nextExamDaysAway = nextExam
    ? Math.ceil((nextExam.deadline.getTime() - now.getTime()) / 86400000)
    : null;

  const clinicalWorld = {
    totalEntries: clinicalAgg._count._all,
    totalCases: clinicalAgg._sum.casesSeen ?? 0,
    latestEntry: latestClinical
      ? {
          id: latestClinical.id,
          hospital: latestClinical.hospital,
          department: latestClinical.department,
          date: latestClinical.date,
          reflection: latestClinical.reflection,
          nextAction: latestClinical.nextAction,
        }
      : null,
  };

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
    subjectWorld,
    lectureWorld,
    clinicalWorld,
    activeTasksCount,
    nextExamDaysAway,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
