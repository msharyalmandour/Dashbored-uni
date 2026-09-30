import { notFound } from "next/navigation";
import Link from "next/link";
import { pageTitle } from "@/lib/i18n/page-title";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { OSPageHeader } from "@/components/shared/os-page-header";
import { ContentText } from "@/components/ui/content-text";
import { ArrowLeft } from "lucide-react";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getProcedure } from "@/lib/procedures";
import { PracticeRun } from "@/components/clinical/practice-run";
import { FileProcedure } from "@/components/clinical/file-procedure";

export const generateMetadata = pageTitle((dict) => dict.nav.items.clinical.label);
export const dynamic = "force-dynamic";

/**
 * One procedure, run as a station.
 *
 * The page is the checklist and nothing else. There is no notes field, no
 * reflection box and no place to describe the shift — those were the columns
 * on the model this replaces, and they are the reason it held no rows.
 */
export default async function ProcedurePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const dict = getDictionary(await getLocale());
  const t = dict.clinical;

  const procedure = await getProcedure(userId, id);
  if (!procedure) notFound();

  /* Only fetched when it is needed. A procedure that already has a course does
     not need the course list, and most will have one. */
  const subjects = procedure.subjectId
    ? []
    : await prisma.subject.findMany({
        where: { userId, status: { not: "ARCHIVED" } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/clinical"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-[color:var(--foreground)]"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" />
          {t.title}
        </Link>
      </div>

      <OSPageHeader
        title={procedure.name}
        state={
          procedure.subjectName ? (
            <ContentText as="span">{procedure.subjectName}</ContentText>
          ) : (
            t.unfiled
          )
        }
      />

      {/* A procedure with no course cannot record a miss, because a Mistake
          needs one. Rather than filing it under a guess — the mistake that put
          a book in his course list — the page says so and offers the choice
          once. The checklist below stays readable meanwhile. */}
      {!procedure.subjectId && <FileProcedure procedureId={procedure.id} subjects={subjects} />}

      {procedure.steps.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.noSteps}</p>
      ) : (
        <PracticeRun
          procedureId={procedure.id}
          steps={procedure.steps}
          missCounts={[...procedure.missCounts.entries()]}
          canPractise={procedure.subjectId !== null}
        />
      )}
    </div>
  );
}
