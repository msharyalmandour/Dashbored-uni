import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { StatCard } from "@/components/shared/stat-card";
import { ProblemFilterBar } from "@/components/problems/problem-filter-bar";
import { CreateProblemDialog } from "@/components/problems/create-problem-dialog";
import { ProblemsList, type ProblemRow } from "@/components/problems/problems-list";
import { CheckCircle2, XCircle, PencilLine } from "lucide-react";
import type { Difficulty, ProblemStatus } from "@prisma/client";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const metadata = { title: "Problems" };

export default async function ProblemsPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; status?: string; difficulty?: string }>;
}) {
  const sp = await searchParams;
  const userId = await getCurrentUserId();
  const dict = getDictionary(await getLocale());

  const subjects = await prisma.subject.findMany({
    where: { userId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const [problems, total, correct, incorrect] = await Promise.all([
    prisma.problem.findMany({
      where: {
        userId,
        subjectId: sp.subject,
        status: sp.status as ProblemStatus | undefined,
        difficulty: sp.difficulty as Difficulty | undefined,
      },
      include: { subject: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.problem.count({ where: { userId } }),
    prisma.problem.count({ where: { userId, status: "CORRECT" } }),
    prisma.problem.count({ where: { userId, status: "INCORRECT" } }),
  ]);

  const rows: ProblemRow[] = problems.map((p) => ({
    id: p.id,
    question: p.question,
    correctAnswer: p.correctAnswer,
    difficulty: p.difficulty,
    subjectName: p.subject.name,
    status: p.status,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{dict.problems.title}</h1>
          <p className="text-sm text-muted-foreground">{dict.problems.subtitle}</p>
        </div>
        <CreateProblemDialog subjects={subjects} defaultSubjectId={sp.subject} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label={dict.problems.totalProblems} value={total} icon={PencilLine} />
        <StatCard label={dict.problems.correct} value={correct} icon={CheckCircle2} tone="success" />
        <StatCard label={dict.problems.incorrect} value={incorrect} icon={XCircle} tone="destructive" />
      </div>

      <ProblemFilterBar subjects={subjects} />

      <ProblemsList problems={rows} />
    </div>
  );
}
