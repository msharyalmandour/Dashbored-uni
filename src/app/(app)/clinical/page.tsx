import Link from "next/link";
import { pageTitle } from "@/lib/i18n/page-title";
import { getCurrentUserId } from "@/lib/current-user";
import { OSPageHeader, StateLine } from "@/components/shared/os-page-header";
import { TtSection, TtEmpty } from "@/components/shared/tt";
import { ContentText } from "@/components/ui/content-text";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, FileCheck2 } from "lucide-react";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatDate } from "@/lib/utils";
import { listProcedures } from "@/lib/procedures";
import { shortCourseName } from "@/lib/course-code";
import { prisma } from "@/lib/prisma";
import { AddProcedure } from "@/components/clinical/add-procedure";
import { HospitalHero, type OspeInfo } from "@/components/clinical/hospital-hero";
import { nextHospitalDays, type ClinicalSlot } from "@/lib/clinical-days";
import { weightFromTitle } from "@/lib/exam-weight";

export const generateMetadata = pageTitle((dict) => dict.nav.items.clinical.label);
export const dynamic = "force-dynamic";

/**
 * CLINICAL — the procedures, in the order worth practising.
 *
 * This page used to be a shift journal, built on `ClinicalTraining`: hospital,
 * department, supervisor, what I learned, what I did not understand, questions
 * to ask, reflection, next action. It was one of the five top-level
 * destinations and it held ZERO rows after twenty-four days of real use. Nobody
 * writes five essay fields at the end of an eight-hour shift, and a form that
 * costs more than it returns does not get filled in once.
 *
 * What replaces it is shaped like the exam instead of like a diary. An OSPE
 * examiner says "insert a nasogastric tube" and marks the steps performed and
 * omitted, so the unit here is a procedure and its ordered steps, and the
 * interaction is ticking what you missed.
 *
 * The order comes from `practiceOrder` in ospe.ts — never practised first,
 * then longest since practised, criticals breaking ties — and not from a score
 * this page computes for itself.
 *
 * And then it too held zero rows, for a different reason. The replacement was
 * right about the shape and wrong about the way in: the only thing that could
 * make a Procedure was the agent's `create_procedure`, and the agent has
 * written nothing since 11 September for want of credit. Measured on this
 * account, every flashcard, gap and topic carries that same date; only the two
 * things with a hand path — documents and lectures — kept growing. So the
 * paste dialog below is not a convenience. It is the input this page never had.
 */
export default async function ClinicalPage() {
  const userId = await getCurrentUserId();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.clinical;

  const [procedures, subjects] = await Promise.all([
    listProcedures(userId),
    prisma.subject.findMany({
      where: { userId, status: { not: "ARCHIVED" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const neverPractised = procedures.filter((p) => p.lastPracticedAt === null).length;

  /* WHEN HE IS NEXT IN, from the recurring timetable and not from
     `ScheduleEvent`: the three dated clinical rows on this account are all
     in September, so a dated query returns an empty hospital week. */
  const now = new Date();
  const [clinicalRows, nearestOspe] = await Promise.all([
    prisma.timeCommitment.findMany({
      where: { userId, kind: "CLINICAL", weekday: { not: null } },
      select: {
        subjectId: true,
        weekday: true,
        startMinute: true,
        endMinute: true,
        subject: { select: { name: true, code: true } },
      },
    }),
    /* The nearest OSPE still ahead. "OSPE" in the title rather than a type,
       because an OSPE is stored as an EXAM like any other and only its name
       says which kind it is. */
    prisma.task.findFirst({
      where: {
        userId,
        type: "EXAM",
        status: { not: "COMPLETED" },
        title: { contains: "OSPE", mode: "insensitive" },
        deadline: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
      },
      orderBy: { deadline: "asc" },
      select: { title: true, deadline: true },
    }),
  ]);

  const slots: ClinicalSlot[] = clinicalRows.map((r) => ({
    subjectId: r.subjectId,
    weekday: r.weekday!,
    startMinute: r.startMinute,
    endMinute: r.endMinute,
    subjectName: r.subject ? shortCourseName(r.subject.name, r.subject.code) : null,
  }));
  const hospitalDays = nextHospitalDays(slots, now, 4);

  const ospe: OspeInfo | null = nearestOspe
    ? {
        title: nearestOspe.title,
        daysLeft: Math.round(
          (new Date(
            nearestOspe.deadline.getFullYear(),
            nearestOspe.deadline.getMonth(),
            nearestOspe.deadline.getDate()
          ).getTime() -
            new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
            86400000
        ),
        weight: weightFromTitle(nearestOspe.title),
      }
    : null;

  return (
    <div className="flex flex-col gap-6">
      {/* ABOVE THE PROCEDURES, NOT INSTEAD OF THEM. The list below was the
          right answer to "what does a clinical page hold" and the reasoning
          is in the comment at the top of this file. What it never answered
          is "when am I next in", which is the question he opens this page
          with on a Monday night. */}
      <HospitalHero
        days={hospitalDays}
        ospe={ospe}
        nowMs={now.getTime()}
        locale={locale}
        t={t.hero}
        weekdayNames={dict.time.weekdays}
      />

      <OSPageHeader
        title={t.title}
        state={
          procedures.length > 0 ? (
            <StateLine
              template={t.stateLine}
              values={{ total: procedures.length, fresh: neverPractised }}
              tones={{ fresh: "due" }}
            />
          ) : (
            t.subtitle
          )
        }
        actions={<AddProcedure subjects={subjects} />}
      />

      <TtSection title={t.proceduresSection} count={procedures.length}>
        {procedures.length === 0 ? (
          /* Two ways in, and the second one is the one that always works.
             This used to name dropping a file as the only path, on the
             argument that typing a twelve-step checklist costs what the old
             shift form cost. That was right about typing and wrong about the
             alternative: pasting is one selection, and the drop has been
             dead since 11 September. */
          <div className="flex flex-col items-center gap-3 py-2">
            <TtEmpty>{t.emptyTitle}</TtEmpty>
            <p className="text-xs text-muted-foreground">{t.emptyOrPaste}</p>
            <AddProcedure subjects={subjects} variant="quiet" />
          </div>
        ) : (
          <ul className="divide-y divide-[color:var(--border)]">
            {procedures.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/clinical/${p.id}`}
                  className="group/proc flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[color:var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--ring)]"
                >
                  <div className="min-w-0 flex-1">
                    <ContentText as="p" className="truncate text-sm font-medium">
                      {p.name}
                    </ContentText>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{t.stepCount.replace("{count}", String(p.stepCount))}</span>
                      {p.subjectName && (
                        <>
                          <span aria-hidden>·</span>
                          <ContentText as="span">{p.subjectName}</ContentText>
                        </>
                      )}
                      <span aria-hidden>·</span>
                      {/* Never practised is said in words, not as a date that
                          is not there. The two are genuinely different facts
                          and the ordering treats them differently. */}
                      <span>
                        {p.lastPracticedAt
                          ? t.lastPractised.replace("{date}", formatDate(p.lastPracticedAt, locale))
                          : t.neverPractised}
                      </span>
                    </p>
                  </div>

                  {/* Only shown when true. A checklist taken from the student's
                      own faculty sheet is worth more than one written from a
                      model's memory, and this is the only place that says so. */}
                  {p.fromDocument && (
                    <Badge variant="outline" className="hidden shrink-0 gap-1 sm:flex">
                      <FileCheck2 className="size-3" />
                      {t.fromYourFile}
                    </Badge>
                  )}

                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover/proc:translate-x-0.5 rtl:rotate-[-90deg]" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </TtSection>
    </div>
  );
}
