import { prisma } from "@/lib/prisma";

export interface RepeatedWeakness {
  key: string;
  topicName: string | null;
  subjectName: string;
  subjectColor: string;
  incorrectCount: number;
  recommendation: string;
}

const THRESHOLD = 3;

/**
 * "REPEATED WEAKNESS DETECTED" — groups open mistakes by topic (falling back
 * to subject when a mistake isn't tied to a topic) and surfaces any group
 * that has piled up past the threshold, exactly like the spec's Drug
 * Distribution example.
 */
export async function detectRepeatedWeaknesses(userId: string): Promise<RepeatedWeakness[]> {
  const mistakes = await prisma.mistake.findMany({
    where: { userId, status: { not: "RESOLVED" } },
    include: { subject: true, topic: true },
  });

  const groups = new Map<string, { topicName: string | null; subjectName: string; subjectColor: string; count: number }>();

  for (const m of mistakes) {
    const key = m.topicId ?? `subject-${m.subjectId}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(key, {
        topicName: m.topic?.name ?? null,
        subjectName: m.subject.name,
        subjectColor: m.subject.color,
        count: 1,
      });
    }
  }

  return Array.from(groups.entries())
    .filter(([, g]) => g.count >= THRESHOLD)
    .map(([key, g]) => ({
      key,
      topicName: g.topicName,
      subjectName: g.subjectName,
      subjectColor: g.subjectColor,
      incorrectCount: g.count,
      recommendation: `Review ${g.topicName ?? g.subjectName} and complete 10 practice questions.`,
    }))
    .sort((a, b) => b.incorrectCount - a.incorrectCount);
}
