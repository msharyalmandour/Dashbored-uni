import { prisma } from "@/lib/prisma";
import { computeRecommendations } from "@/lib/priority-engine";
import { computeAcademicHealth } from "@/lib/academic-health";
import { getUserGaps } from "@/lib/user-data";
import { chooseNextAction } from "@/lib/decision-engine";
import { remainingCapacityToday, summariseWorkload, detectCollision } from "@/lib/time-intelligence";
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
  const weekAhead = new Date(now.getTime() + 7 * 86400000);

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
    inboxWaiting,
    inboxWaitingCount,
    timeCommitments,
    weekTasks,
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
    // Shared, request-cached: the academic-health score reads the same rows.
    getUserGaps(userId),
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
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    prisma.subject.findMany({
      where: { userId, status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        code: true,
        color: true,
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
    prisma.clinicalTraining.findFirst({
      where: { userId },
      orderBy: { date: "desc" },
      select: { id: true, hospital: true, department: true, date: true, reflection: true, nextAction: true },
    }),
    prisma.task.count({ where: { userId, status: { not: "COMPLETED" } } }),
    prisma.task.findFirst({
      where: { userId, type: "EXAM", status: { not: "COMPLETED" }, deadline: { gte: todayStart } },
      orderBy: { deadline: "asc" },
      select: { deadline: true },
    }),
    // The inbox band on the dashboard. Fetched as rows rather than a count
    // because seeing *what* is waiting is what makes someone go and deal with
    // it; a bare number is just a badge to ignore.
    prisma.captureItem.findMany({
      where: { userId, status: { not: "ORGANIZED" } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        kind: true,
        text: true,
        status: true,
        document: { select: { originalName: true } },
      },
    }),
    // Counted separately: the preview above is capped at three, so its length
    // would understate a genuinely full inbox.
    prisma.captureItem.count({ where: { userId, status: { not: "ORGANIZED" } } }),
    // The student's real week. Without these rows nothing can honestly say
    // how much time is left in a day, and the UI asks for them rather than
    // filling the gap with an assumption.
    prisma.timeCommitment.findMany({
      where: { userId },
      select: {
        id: true,
        kind: true,
        label: true,
        weekday: true,
        startMinute: true,
        endMinute: true,
      },
    }),
    // Everything due in the next seven days, for the fits-or-doesn't check.
    // Separate from `upcomingTasks` (capped at six for display) because a
    // workload total computed from a truncated list would understate it.
    prisma.task.findMany({
      where: { userId, status: { not: "COMPLETED" }, deadline: { lte: weekAhead } },
      select: {
        id: true,
        title: true,
        deadline: true,
        estimatedMinutes: true,
        completionPercentage: true,
      },
    }),
  ]);

  // The time layer. `chooseNextAction` reuses the recommendations already
  // computed above rather than ranking anything a second time — what it adds
  // is which one to actually say, given the hours genuinely left today.
  const capacity = remainingCapacityToday(timeCommitments, now);
  const collision = detectCollision(capacity, summariseWorkload(weekTasks, weekAhead));
  const decision = {
    action: chooseNextAction(recommendations, capacity),
    capacity,
    collision,
    needsTimeSetup: timeCommitments.length === 0,
  };

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
    decision,
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
    inbox: {
      waitingCount: inboxWaitingCount,
      preview: inboxWaiting.map((c) => ({
        id: c.id,
        kind: c.kind,
        status: c.status,
        label: c.document?.originalName ?? c.text ?? "",
      })),
    },
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
