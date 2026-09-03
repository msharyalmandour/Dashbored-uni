import { prisma } from "@/lib/prisma";
import { clamp } from "@/lib/utils";

export type RecommendationType =
  | "FLASHCARDS"
  | "KNOWLEDGE_GAP"
  | "TASK"
  | "REVIEW"
  | "MISTAKE";

export interface Recommendation {
  id: string;
  type: RecommendationType;
  title: string;
  reason: string;
  score: number; // 0-100 Academic Priority Score
  estimatedMinutes: number;
  href: string;
  subjectName?: string;
  subjectColor?: string;
}

function tier(score: number) {
  if (score >= 80) return "HIGH" as const;
  if (score >= 55) return "MEDIUM" as const;
  return "LOW" as const;
}

/**
 * The Smart Priority Engine. Pulls every signal the spec calls out —
 * deadline urgency, exam proximity, knowledge gaps, repeated mistakes,
 * overdue reviews, flashcards due, subject difficulty, user progress —
 * and reduces it to a single ranked "what should I do next" list where
 * every entry can explain itself.
 */
export async function computeRecommendations(
  userId: string,
  limit = 8
): Promise<Recommendation[]> {
  const now = new Date();
  const candidates: Recommendation[] = [];

  // ---- 1. Flashcards due, grouped by subject -----------------------------
  const dueCards = await prisma.flashcard.findMany({
    where: { userId, nextReviewDate: { lte: now } },
    include: { subject: true },
  });
  const bySubject = new Map<string, typeof dueCards>();
  for (const card of dueCards) {
    const list = bySubject.get(card.subjectId) ?? [];
    list.push(card);
    bySubject.set(card.subjectId, list);
  }
  for (const [subjectId, cards] of bySubject) {
    const subject = cards[0].subject;
    const avgOverdueDays =
      cards.reduce(
        (sum, c) => sum + Math.max(0, (now.getTime() - c.nextReviewDate.getTime()) / 86400000),
        0
      ) / cards.length;
    const score = clamp(40 + cards.length * 3 + avgOverdueDays * 2, 0, 100);
    candidates.push({
      id: `flash-${subjectId}`,
      type: "FLASHCARDS",
      title: `Review ${subject.name} Flashcards`,
      reason: `${cards.length} card${cards.length === 1 ? "" : "s"} overdue`,
      score,
      estimatedMinutes: clamp(cards.length, 5, 30),
      href: `/flashcards?subject=${subjectId}`,
      subjectName: subject.name,
      subjectColor: subject.color,
    });
  }

  // ---- 2. Knowledge gaps still open, weighted by connected mistakes -----
  const gaps = await prisma.knowledgeGap.findMany({
    where: { status: { notIn: ["UNDERSTOOD", "MASTERED"] }, subject: { userId } },
    include: {
      subject: true,
      mistakes: true,
      problems: true,
    },
  });
  for (const gap of gaps) {
    const connectedMistakes = gap.mistakes.length;
    const connectedProblems = gap.problems.filter((p) => p.status === "INCORRECT").length;
    const score = clamp(
      50 + connectedMistakes * 8 + connectedProblems * 4 + (gap.difficulty === "HARD" ? 10 : 0),
      0,
      100
    );
    if (connectedMistakes + connectedProblems === 0 && score < 55) continue;
    candidates.push({
      id: `gap-${gap.id}`,
      type: "KNOWLEDGE_GAP",
      title: `Fix Knowledge Gap: ${gap.title}`,
      reason:
        connectedMistakes > 0
          ? `Connected to ${connectedMistakes} incorrect question${connectedMistakes === 1 ? "" : "s"}`
          : `Marked "${gap.status.replace("_", " ").toLowerCase()}" — needs attention`,
      score,
      estimatedMinutes: 20,
      href: `/knowledge-gaps?gap=${gap.id}`,
      subjectName: gap.subject.name,
      subjectColor: gap.subject.color,
    });
  }

  // ---- 3. Tasks / deadlines ----------------------------------------------
  const tasks = await prisma.task.findMany({
    where: { userId, status: { not: "COMPLETED" } },
    include: { subject: true },
    orderBy: { deadline: "asc" },
  });
  for (const task of tasks) {
    const daysLeft = Math.ceil((task.deadline.getTime() - now.getTime()) / 86400000);
    let score = 30;
    let reason = "Due in the future";
    if (daysLeft < 0) {
      score = 98;
      reason = `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"}`;
    } else if (daysLeft === 0) {
      score = 92;
      reason = "Deadline today";
    } else if (daysLeft === 1) {
      score = 88;
      reason = "Deadline tomorrow";
    } else if (daysLeft <= 3) {
      score = 74;
      reason = `Due in ${daysLeft} days`;
    } else if (daysLeft <= 7) {
      score = 55;
      reason = `Due in ${daysLeft} days`;
    }
    if (task.priority === "URGENT") score += 8;
    if (task.priority === "HIGH") score += 4;
    if (task.type === "EXAM") score += 6;
    score = clamp(score, 0, 100);

    candidates.push({
      id: `task-${task.id}`,
      type: "TASK",
      title:
        task.type === "EXAM"
          ? `Prepare for Exam: ${task.title}`
          : `Complete ${task.title}`,
      reason,
      score,
      estimatedMinutes: task.type === "EXAM" ? 90 : task.type === "PROJECT" ? 60 : 30,
      href: `/tasks?task=${task.id}`,
      subjectName: task.subject?.name,
      subjectColor: task.subject?.color,
    });
  }

  // ---- 4. Overdue review items, grouped by type --------------------------
  const overdueReviews = await prisma.reviewItem.findMany({
    where: { userId, status: { in: ["SCHEDULED", "DUE"] }, scheduledDate: { lte: now } },
    include: { subject: true },
  });
  const byTypeSubject = new Map<string, typeof overdueReviews>();
  for (const r of overdueReviews) {
    const key = `${r.type}-${r.subjectId}`;
    const list = byTypeSubject.get(key) ?? [];
    list.push(r);
    byTypeSubject.set(key, list);
  }
  for (const [, items] of byTypeSubject) {
    const first = items[0];
    const score = clamp(45 + items.length * 6, 0, 100);
    const label = first.type.replace("_", " ").toLowerCase();
    candidates.push({
      id: `review-${first.type}-${first.subjectId}`,
      type: "REVIEW",
      title: `Review ${items.length} ${label}${items.length === 1 ? "" : "s"} — ${first.subject.name}`,
      reason: `${items.length} overdue review${items.length === 1 ? "" : "s"}`,
      score,
      estimatedMinutes: clamp(items.length * 5, 10, 45),
      href: `/review`,
      subjectName: first.subject.name,
      subjectColor: first.subject.color,
    });
  }

  // ---- 5. Repeated mistakes ------------------------------------------------
  const mistakes = await prisma.mistake.findMany({
    where: { userId, status: { not: "RESOLVED" }, frequency: { gte: 2 } },
    include: { subject: true, topic: true },
  });
  for (const m of mistakes) {
    const score = clamp(50 + m.frequency * 7, 0, 100);
    candidates.push({
      id: `mistake-${m.id}`,
      type: "MISTAKE",
      title: `Drill Weakness: ${m.topic?.name ?? m.subject.name}`,
      reason: `${m.frequency} repeated incorrect answers`,
      score,
      estimatedMinutes: 25,
      href: `/mistakes?mistake=${m.id}`,
      subjectName: m.subject.name,
      subjectColor: m.subject.color,
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, limit);
}

export function recommendationTier(score: number) {
  return tier(score);
}
