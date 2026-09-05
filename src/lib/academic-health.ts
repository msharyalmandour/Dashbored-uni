import { prisma } from "@/lib/prisma";
import { clamp } from "@/lib/utils";
import { format, type Dictionary } from "@/lib/i18n/dictionaries";

export type HealthSignal =
  | { key: "completionGood" | "completionBehind" }
  | { key: "reviewsConsistent" }
  | { key: "reviewsOverdue"; count: number }
  | { key: "gapsFew" }
  | { key: "gapsUnresolved"; count: number }
  | { key: "deadlinesUnderControl" }
  | { key: "deadlinesOverdue"; count: number }
  | { key: "deadlinesDueSoon" }
  | { key: "practiceStrong" | "practiceNeedsWork" };

export interface AcademicHealth {
  score: number;
  breakdown: {
    completion: number;
    reviews: number;
    knowledgeGaps: number;
    deadlines: number;
    practice: number;
  };
  strengths: HealthSignal[];
  weaknesses: HealthSignal[];
}

const WEIGHTS = {
  completion: 0.25,
  reviews: 0.2,
  knowledgeGaps: 0.2,
  deadlines: 0.15,
  practice: 0.2,
};

export async function computeAcademicHealth(userId: string): Promise<AcademicHealth> {
  const now = new Date();

  const [lectures, gaps, tasks, problems, overdueReviews, allReviews] = await Promise.all([
    prisma.lecture.findMany({ where: { subject: { userId } } }),
    prisma.knowledgeGap.findMany({ where: { subject: { userId } } }),
    prisma.task.findMany({ where: { userId } }),
    prisma.problem.findMany({ where: { userId } }),
    prisma.reviewItem.count({
      where: { userId, status: { in: ["SCHEDULED", "DUE"] }, scheduledDate: { lt: now } },
    }),
    prisma.reviewItem.findMany({ where: { userId } }),
  ]);

  // Completion: average lecture completion across all lectures.
  const completion =
    lectures.length > 0
      ? lectures.reduce((s, l) => s + l.completionPercentage, 0) / lectures.length
      : 70;

  // Reviews: penalize overdue reviews relative to total scheduled.
  const completedReviews = allReviews.filter((r) => r.status === "COMPLETED").length;
  const reviewCompletionRate =
    allReviews.length > 0 ? (completedReviews / allReviews.length) * 100 : 80;
  const reviews = clamp(reviewCompletionRate - overdueReviews * 4, 0, 100);

  // Knowledge gaps: penalize unresolved gaps, more for HARD ones.
  const unresolvedGaps = gaps.filter((g) => g.status !== "UNDERSTOOD" && g.status !== "MASTERED");
  const hardUnresolved = unresolvedGaps.filter((g) => g.difficulty === "HARD").length;
  const knowledgeGaps = clamp(100 - unresolvedGaps.length * 5 - hardUnresolved * 5, 0, 100);

  // Deadlines: penalize overdue and imminent tasks.
  const overdueTasks = tasks.filter(
    (t) => t.status !== "COMPLETED" && t.deadline < now
  ).length;
  const dueSoonTasks = tasks.filter((t) => {
    if (t.status === "COMPLETED") return false;
    const days = (t.deadline.getTime() - now.getTime()) / 86400000;
    return days >= 0 && days <= 3;
  }).length;
  const deadlines = clamp(100 - overdueTasks * 15 - dueSoonTasks * 6, 0, 100);

  // Practice performance: correctness rate on attempted problems.
  const attempted = problems.filter((p) => p.status === "CORRECT" || p.status === "INCORRECT");
  const correct = problems.filter((p) => p.status === "CORRECT").length;
  const practice = attempted.length > 0 ? (correct / attempted.length) * 100 : 70;

  const score = clamp(
    Math.round(
      completion * WEIGHTS.completion +
        reviews * WEIGHTS.reviews +
        knowledgeGaps * WEIGHTS.knowledgeGaps +
        deadlines * WEIGHTS.deadlines +
        practice * WEIGHTS.practice
    ),
    0,
    100
  );

  const strengths: HealthSignal[] = [];
  const weaknesses: HealthSignal[] = [];

  if (completion >= 75) strengths.push({ key: "completionGood" });
  else weaknesses.push({ key: "completionBehind" });

  if (reviews >= 75) strengths.push({ key: "reviewsConsistent" });
  else weaknesses.push({ key: "reviewsOverdue", count: overdueReviews });

  if (knowledgeGaps >= 75) strengths.push({ key: "gapsFew" });
  else weaknesses.push({ key: "gapsUnresolved", count: unresolvedGaps.length });

  if (deadlines >= 75) strengths.push({ key: "deadlinesUnderControl" });
  else if (overdueTasks > 0) weaknesses.push({ key: "deadlinesOverdue", count: overdueTasks });
  else if (dueSoonTasks > 0) weaknesses.push({ key: "deadlinesDueSoon" });

  if (practice >= 75) strengths.push({ key: "practiceStrong" });
  else if (attempted.length > 0) weaknesses.push({ key: "practiceNeedsWork" });

  return {
    score,
    breakdown: { completion, reviews, knowledgeGaps, deadlines, practice },
    strengths,
    weaknesses,
  };
}

export function formatHealthSignal(signal: HealthSignal, dict: Dictionary): string {
  const template = dict.dashboard.healthSignals[signal.key];
  return "count" in signal ? format(template, { count: signal.count }) : template;
}
