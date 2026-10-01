import { prisma } from "@/lib/prisma";
import { dueFlashcardsWhere, dueReviewItemsWhere, totalDue } from "@/lib/review-due";
import { computeRecommendations } from "@/lib/priority-engine";
import { computeAcademicHealth } from "@/lib/academic-health";
import { getUserGaps } from "@/lib/user-data";
import { courseProgress } from "@/lib/course-progress";
import { chooseNextAction } from "@/lib/decision-engine";
import {
  remainingCapacityToday,
  dayCapacity,
  summariseWorkload,
  detectCollision,
} from "@/lib/time-intelligence";
import { classesOn } from "@/lib/today-classes";
import { examReadiness, type UnreadLecture } from "@/lib/exam-readiness";
import { readDay } from "@/lib/daily-loop";
import { readEvening, isEvening } from "@/lib/evening";
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


/**
 * A time on a given day, from minutes past local midnight.
 *
 * Built by adding minutes to the day's start rather than with `setHours`, so a
 * commitment recorded past midnight lands on the following day instead of
 * silently wrapping to the same morning.
 */
function atMinute(dayStart: Date, minute: number): Date {
  return new Date(dayStart.getTime() + minute * 60_000);
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
    openDueToday,
    focusMinutesToday,
    user,
    activeSubjectsCount,
    upcomingExamsCount,
    subjectsPreview,
    recentLecture,
    clinicalAgg,
    latestClinical,
    activeTasksCount,
    nextExam,
    timeCommitments,
    weekTasks,
    nextEvent,
    datedToday,
    upcomingExams,
    lecturesWithDecks,
  ] = await Promise.all([
    computeRecommendations(userId, 6, dict),
    computeAcademicHealth(userId),
    prisma.task.findMany({
      where: { userId, status: { not: "COMPLETED" } },
      include: { subject: true },
      orderBy: { deadline: "asc" },
      take: 6,
    }),
    /* Chain reviews only — the ones about a lecture, a gap or a mistake.
    
       A ReviewItem carrying a flashcardId is the same work as that card being
       due, and `flashcardsDueCount` below already counts those. Asking for both
       without this exclusion reports two things to do where the student sees one
       card, and a number that overstates the pile is its own reason not to
       start. See src/lib/review-due.ts. */
    prisma.reviewItem.findMany({
      where: { ...dueReviewItemsWhere(userId, todayEnd) },
      include: { subject: true, lecture: true, topic: true, flashcard: true, knowledgeGap: true, mistake: true },
      orderBy: { scheduledDate: "asc" },
    }),
    // Shared, request-cached: the academic-health score reads the same rows.
    getUserGaps(userId),
    prisma.flashcard.count({ where: dueFlashcardsWhere(userId, now) }),
    prisma.task.count({
      where: { userId, status: "COMPLETED", updatedAt: { gte: todayStart } },
    }),
    prisma.task.count({
      where: { userId, deadline: { gte: todayStart, lte: todayEnd } },
    }),
    // Due today and still not done. Distinct from `tasksDueToday`, which
    // counts everything dated today including what has already been closed.
    prisma.task.count({
      where: {
        userId,
        status: { not: "COMPLETED" },
        deadline: { gte: todayStart, lte: todayEnd },
      },
    }),
    prisma.focusSession.aggregate({
      where: { userId, startedAt: { gte: todayStart }, status: "COMPLETED" },
      _sum: { actualMinutes: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    /* Totals, not the length of a preview.
    
       `subjectsPreview` below takes 4 so the worlds panel has something to
       show; Home states how many courses there ARE. Measured on the real
       account those differ — 7 against 4 — so reading a count off the preview
       would have printed a number that is simply wrong, in the one place on
       the page whose whole job is to be the true total. Two counts, one round
       trip each, both landing on an index. */
    prisma.subject.count({ where: { userId, status: "ACTIVE" } }),
    prisma.task.count({
      where: { userId, type: "EXAM", status: { not: "COMPLETED" }, deadline: { gte: todayStart } },
    }),
    prisma.subject.findMany({
      where: { userId, status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        code: true,
        color: true,
        /* The evidence a course's progress is actually read from.
        
           This used to be `completionPercentage` alone — the manual field set
           by one control on the lecture page. Measured on this account, every
           lecture reads 0, so all six courses showed 0% on the live site while
           two of them had been read to the end. See src/lib/course-progress.ts
           for the refutation; this is the query that replaces it. */
        lectures: {
          select: {
            status: true,
            slides: { select: { positions: { select: { completedAt: true } } } },
          },
        },
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
    // The next thing the student has to physically be somewhere for. Until
    // now nothing rendered ScheduleEvent at all, so a timetable the student
    // imported was invisible to them.
    prisma.scheduleEvent.findFirst({
      where: { userId, startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      select: { id: true, title: true, type: true, startsAt: true, endsAt: true, location: true },
    }),
    /* TODAY'S CLASSES, all of them.
    
       The line above fetched the NEXT one and nothing fetched the rest, so
       Home's "Today" panel showed tasks and reviews while the student's actual
       day — eleven imported classes with real times, real durations of 50 to
       290 minutes, and a location on the clinical ones — was not on the page
       that is supposed to show their day.
    
       Bounded to the calendar day rather than "from now", because a class
       already finished is still part of what today was, and the panel dims it
       instead of hiding it. */
    prisma.scheduleEvent.findMany({
      where: { userId, startsAt: { gte: todayStart, lte: todayEnd } },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        title: true,
        type: true,
        startsAt: true,
        endsAt: true,
        location: true,
        subjectId: true,
        lectureId: true,
        subject: { select: { name: true, color: true } },
      },
    }),
    /* The exams still ahead, and every lecture that has a deck.
    
       Separate from the subject preview above, which takes four courses and
       selects only what a card prints. The exam band needs page counts and
       reading positions across whichever course the next exam covers, and
       bending the preview query to carry both would make one query answer two
       questions — the shape that produced the 0% bug this file already
       documents. Five decks on this account; the cost is a rounding error. */
    prisma.task.findMany({
      where: { userId, type: "EXAM", status: { not: "COMPLETED" }, deadline: { gte: now } },
      select: { id: true, title: true, deadline: true, subject: { select: { name: true } } },
      orderBy: { deadline: "asc" },
      take: 5,
    }),
    prisma.lecture.findMany({
      where: { subject: { userId } },
      select: {
        id: true,
        title: true,
        subject: { select: { name: true } },
        slides: { select: { pageCount: true, positions: { select: { furthestPage: true } } } },
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

  // How today actually reads, from the same real numbers — not a random
  // encouragement that says the same thing on a quiet day and a brutal one.
  const situation = readDay({
    collision,
    today: capacity,
    daysToNearest: nextExam
      ? Math.ceil((nextExam.deadline.getTime() - now.getTime()) / 86400000)
      : null,
  });

  // The evening half of the loop. Computed unconditionally — it is cheap, it
  // reuses rows already fetched, and the component decides whether the hour
  // is late enough for any of it to be worth saying.
  const tomorrowStart = new Date(todayEnd.getTime() + 1);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(23, 59, 59, 999);
  const tomorrowTasks = weekTasks.filter(
    (t) => t.deadline >= tomorrowStart && t.deadline <= tomorrowEnd
  );
  const evening = readEvening({
    tasksCompleted: tasksCompletedToday,
    focusMinutes: focusMinutesToday._sum.actualMinutes ?? 0,
    openDueToday,
    dueTomorrow: tomorrowTasks.length,
    // Tomorrow is a whole day, not a remainder — so `dayCapacity`, not the
    // now-prorated version used for today.
    tomorrow: detectCollision(
      dayCapacity(timeCommitments, tomorrowStart),
      summariseWorkload(tomorrowTasks, tomorrowEnd)
    ),
  });

  const unresolvedGaps = gaps.filter((g) => g.status !== "UNDERSTOOD" && g.status !== "MASTERED");
  const difficultGaps = unresolvedGaps.filter((g) => g.difficulty === "HARD");
  const recentlyResolved = gaps.filter(
    (g) => g.resolvedAt && g.resolvedAt.getTime() > now.getTime() - 7 * 86400000
  );

  /* The exam the student has, and the pages they have not read for it.
  
     Grouped by the course NAME because that is the only key the two sides
     share: a Task carries its subject relation and so does a Lecture, and the
     name is what the student sees written on both. The rule, the threshold and
     the reason it stays quiet are in src/lib/exam-readiness.ts. */
  const lecturesByCourse = new Map<string, UnreadLecture[]>();
  for (const l of lecturesWithDecks) {
    const course = l.subject.name;
    const pages = l.slides.reduce((n, d) => n + d.pageCount, 0);
    /* The furthest page reached across this lecture's decks. A lecture with
       two decks read to page 10 and page 3 has been read to 13 of its total,
       which is what summing gives; taking a max would under-count the second
       deck entirely. */
    const furthestPage = l.slides.reduce(
      (n, d) => n + d.positions.reduce((m, p) => Math.max(m, p.furthestPage), 0),
      0
    );
    const list = lecturesByCourse.get(course) ?? [];
    list.push({ lectureId: l.id, title: l.title, pages, furthestPage });
    lecturesByCourse.set(course, list);
  }

  const examBand = examReadiness(
    upcomingExams.map((e) => ({
      id: e.id,
      title: e.title,
      courseName: e.subject?.name ?? null,
      deadline: e.deadline,
    })),
    lecturesByCourse,
    now
  );

  const subjectWorld = subjectsPreview.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    color: s.color,
    /* A verdict, not a number, because "nothing here yet" and "nothing done
       yet" are different facts and a single float cannot carry both. What the
       card may print is decided in course-progress.ts, where it is tested. */
    progress: courseProgress(
      s.lectures.map((l) => ({
        decks: l.slides.length,
        /* A deck counts as finished when the app stamped completedAt on a
           reading position for it — written as the student reaches the end,
           not typed by them afterwards. */
        decksFinished: l.slides.filter((d) => d.positions.some((p) => p.completedAt !== null)).length,
        markedComplete: l.status === "COMPLETED",
      }))
    ),
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
    situation,
    evening,
    isEvening: isEvening(now),
    nextEvent,
    health,
    upcomingTasks,
    reviewsDue,
    /* What the tile shows, and the only number on this page that answers "how
       much is waiting".
    
       It used to show `reviewsDue.length` — chain reviews alone. Measured on the
       real account that was 0 while forty-two cards were due, so the dashboard
       told the student there was nothing to review, the page called Review
       agreed, and thirteen of the forty-two had ever been answered. That is not
       a student avoiding review. */
    reviewsDueTotal: totalDue({ flashcards: flashcardsDueCount, reviewItems: reviewsDue.length }),
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
    /* Today's classes — from the SHAPE of his week as well as from anything
       specifically dated onto today.

       It used to be the dated table alone, and that table held exactly one
       week: the week the timetable importer ran. Measured on the real
       account, eleven dated events between 10 and 16 September, none after,
       and it was the 30th — so the panel whose whole job is "what do I have
       today" had been blank for a fortnight while his timetable sat correctly
       stored in `TimeCommitment` the entire time. The rule, the
       de-duplication for the week both tables describe, and the reasoning are
       in src/lib/today-classes.ts. */
    todayClasses: classesOn(timeCommitments, datedToday.map((e) => ({
      id: e.id,
      title: e.title,
      type: e.type,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      location: e.location,
      subjectName: e.subject?.name ?? null,
      subjectColor: e.subject?.color ?? null,
      lectureId: e.lectureId,
    })), now).map((e) => ({
      ...e,
      /* Back to a Date for the timeline, which draws a clock face and needs
         one. Built on today's date from minutes past local midnight, which is
         the same naive-local convention both sources are stored in. */
      startsAt: atMinute(todayStart, e.startMinute),
    })),

    examBand,
    subjectWorld,
    lectureWorld,
    clinicalWorld,
    activeTasksCount,
    activeSubjectsCount,
    upcomingExamsCount,
    nextExamDaysAway,
    /* `inbox` was here: a count of unorganised captures and a three-row
       preview, for a band on the dashboard. Both are gone with the queue.
       Measured first — every one of those eleven rows on the real account was
       an error — so the band existed to count the app's own failures and send
       the student to look at them. Two queries saved as well. */
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
