import { pageTitle } from "@/lib/i18n/page-title";
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

export const generateMetadata = pageTitle((dict) => dict.nav.items.problems.label);

export default async function ProblemsPage({
  searchParams,
}: {
  /* `lecture` exists so the lecture workspace can link here and land on
     something. Without it the link would be a filter the page ignores, which
     from the student's side is a dead end wearing a link's clothes. */
  searchParams: Promise<{ subject?: string; status?: string; difficulty?: string; lecture?: string }>;
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
        lectureId: sp.lecture,
        status: sp.status as ProblemStatus | undefined,
        difficulty: sp.difficulty as Difficulty | undefined,
      },
      include: { subject: true, lecture: { select: { id: true, title: true } } },
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
    subjectId: p.subjectId,
    lecture: p.lecture,
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
