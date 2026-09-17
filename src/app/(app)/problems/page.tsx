import { pageTitle } from "@/lib/i18n/page-title";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { OSPageHeader, StateLine } from "@/components/shared/os-page-header";
import { ProblemFilterBar } from "@/components/problems/problem-filter-bar";
import { CreateProblemDialog } from "@/components/problems/create-problem-dialog";
import { ProblemsList, type ProblemRow } from "@/components/problems/problems-list";

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

  const [problems, total, incorrect] = await Promise.all([
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
      <OSPageHeader
        title={dict.problems.title}
        state={
          <StateLine
            template={total > 0 ? dict.problems.stateLine : dict.problems.stateLineClear}
            values={{ total, incorrect }}
            tones={{ incorrect: "due" }}
          />
        }
        actions={<CreateProblemDialog subjects={subjects} defaultSubjectId={sp.subject} />}
      />

      <ProblemFilterBar subjects={subjects} />

      <ProblemsList problems={rows} />
    </div>
  );
}
