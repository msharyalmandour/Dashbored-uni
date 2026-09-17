import Link from "next/link";
import { pageTitle } from "@/lib/i18n/page-title";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { Badge } from "@/components/ui/badge";
import { OSPageHeader, StateLine } from "@/components/shared/os-page-header";
import { OSSection, OSEmptyState } from "@/components/shared/os-section";
import { OSRowGroup } from "@/components/shared/os-row-group";
import { ContentText } from "@/components/ui/content-text";
import { CreateClinicalDialog } from "@/components/clinical/create-clinical-dialog";
import { ConvertToGapDialog } from "@/components/clinical/convert-to-gap-dialog";
import { Stethoscope, Lightbulb, BookOpen, ArrowUpRight } from "lucide-react";
import { GapStatusBadge } from "@/components/shared/status-badges";
import { formatDate } from "@/lib/utils";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { markerFor, POINT_STYLE } from "@/lib/week-palette";

export const generateMetadata = pageTitle((dict) => dict.nav.items.clinical.label);
export const dynamic = "force-dynamic";

export default async function ClinicalPage() {
  const userId = await getCurrentUserId();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const C = dict.clinical;

  const [entries, subjects, sitesCount] = await Promise.all([
    prisma.clinicalTraining.findMany({
      where: { userId },
      /* The gaps a shift produced are the only real bridge between the ward and
         the course: KnowledgeGap carries clinicalTrainingId, subjectId and an
         optional lectureId. Pulling the subject and lecture through here is
         what lets a rotation say which courses it actually touched, without
         inventing a relationship the database does not have. */
      include: {
        knowledgeGaps: {
          include: {
            subject: { select: { id: true, name: true, color: true } },
            lecture: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { date: "desc" },
    }),
    prisma.subject.findMany({
      where: { userId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.clinicalTraining.findMany({
      where: { userId },
      distinct: ["hospital"],
      select: { hospital: true },
    }),
  ]);

  const totalCases = entries.reduce((s, e) => s + e.casesSeen, 0);

  // Group by department, newest shift first. A rotation is the unit a student
  // thinks in — "what did the medical ward teach me" — not the individual shift.
  const byDepartment = new Map<string, typeof entries>();
  for (const e of entries) {
    const key = e.department?.trim() || "";
    const bucket = byDepartment.get(key);
    if (bucket) bucket.push(e);
    else byDepartment.set(key, [e]);
  }

  return (
    <div className="flex flex-col gap-6">
      <OSPageHeader
        title={C.title}
        state={
          <StateLine
            template={entries.length > 0 ? C.stateLine : C.stateLineClear}
            values={{ cases: totalCases, sites: sitesCount.length }}
          />
        }
        actions={<CreateClinicalDialog />}
      />

      {entries.length === 0 ? (
        <OSSection title={C.departments}>
          <OSEmptyState icon={Stethoscope} title={C.noEntriesYet} />
        </OSSection>
      ) : (
        [...byDepartment.entries()].map(([department, shifts]) => {
          // Everything this rotation connects to, gathered from its own gaps.
          const gaps = shifts.flatMap((s) => s.knowledgeGaps);
          const courses = new Map(gaps.map((g) => [g.subject.id, g.subject]));
          const lectures = new Map(
            gaps.filter((g) => g.lecture).map((g) => [g.lecture!.id, g.lecture!])
          );

          return (
            <OSSection
              key={department || "__none"}
              title={department || C.unassignedDepartment}
              count={shifts.length}
              icon={Stethoscope}
              accent={markerFor("CLINICAL")}
              meta={
                <span className="text-xs text-muted-foreground">
                  {shifts.length} {C.shifts}
                </span>
              }
            >
              {/* What this rotation connects back to. The point of the whole
                  page: a ward is not a diary entry, it is a set of things you
                  now need to go and understand. */}
              {(courses.size > 0 || lectures.size > 0) && (
                <div className="flex flex-wrap items-center gap-2 border-b border-[oklch(100%_0_0_/_5%)] px-4 py-3">
                  {courses.size > 0 && (
                    <>
                      <span className="text-xs text-muted-foreground">{C.connectedCourses}</span>
                      {[...courses.values()].map((s) => (
                        <Link
                          key={s.id}
                          href={`/subjects/${s.id}`}
                          className="flex items-center gap-1 rounded-full bg-[oklch(100%_0_0_/_7%)] px-2.5 py-1 text-xs font-medium hover:bg-[oklch(100%_0_0_/_12%)]"
                          style={{ color: s.color }}
                        >
                          <ContentText>{s.name}</ContentText>
                          <ArrowUpRight className="size-3 opacity-70" />
                        </Link>
                      ))}
                    </>
                  )}
                  {lectures.size > 0 && (
                    <>
                      <span className="ms-2 text-xs text-muted-foreground">{C.relatedLectures}</span>
                      {[...lectures.values()].map((l) => (
                        <Link
                          key={l.id}
                          href={`/lectures/${l.id}`}
                          className="flex items-center gap-1 rounded-full bg-[oklch(100%_0_0_/_7%)] px-2.5 py-1 text-xs hover:bg-[oklch(100%_0_0_/_12%)]"
                        >
                          <BookOpen className="size-3 opacity-70" />
                          <ContentText className="max-w-[16rem] truncate">{l.title}</ContentText>
                        </Link>
                      ))}
                    </>
                  )}
                </div>
              )}

              <OSRowGroup limit={3}>
                {shifts.map((entry) => (
                  <div
                    key={entry.id}
                    className="border-b border-[oklch(100%_0_0_/_5%)] px-4 py-4 last:border-b-0"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <ContentText as="p" className="text-sm font-medium">
                          {entry.hospital || C.rotation}
                        </ContentText>
                        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <span>{formatDate(entry.date, locale)}</span>
                          {entry.supervisor && (
                            <>
                              <span aria-hidden>·</span>
                              <ContentText>{entry.supervisor}</ContentText>
                            </>
                          )}
                          {entry.casesSeen > 0 && (
                            <>
                              <span aria-hidden>·</span>
                              <span>
                                {entry.casesSeen} {C.cases}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      {entry.knowledgeGaps.length > 0 && (
                        <Badge variant="secondary">
                          {entry.knowledgeGaps.length}{" "}
                          {entry.knowledgeGaps.length === 1 ? C.gapLinked : C.gapsLinked}
                        </Badge>
                      )}
                    </div>

                    {/* Everything the student wrote, each line stating its own
                        direction — these are the fields most likely to be a mix
                        of Arabic reflection and English clinical terms. */}
                    {(
                      [
                        [C.skills, entry.skillsPracticed],
                        [C.learned, entry.whatILearned],
                        [C.didntUnderstand, entry.whatIDidNotUnderstand],
                        [C.questions, entry.questionsToAsk],
                        [C.reflection, entry.reflection],
                      ] as const
                    )
                      .filter(([, v]) => v)
                      .map(([label, value]) => (
                        <p key={label} className="mt-1 text-sm">
                          <span className="text-muted-foreground">{label} </span>
                          <ContentText>{value}</ContentText>
                        </p>
                      ))}

                    {entry.nextAction && (
                      <p className="mt-1.5 text-sm font-medium">
                        {C.next} <ContentText>{entry.nextAction}</ContentText>
                      </p>
                    )}

                    {/* The gaps this shift produced, each one a door into the
                        course it belongs to. This used to be a count in a badge
                        and nothing else — the connection existed in the database
                        and nowhere on the screen. */}
                    {entry.knowledgeGaps.length > 0 && (
                      <div className="mt-3 flex flex-col gap-1.5 rounded-lg bg-[oklch(100%_0_0_/_4%)] p-2">
                        {entry.knowledgeGaps.map((g) => (
                          <div key={g.id} className="flex flex-wrap items-center justify-between gap-2">
                            <Link
                              href={`/knowledge-gaps?gap=${g.id}`}
                              className="flex min-w-0 flex-1 items-center gap-2 text-sm hover:text-primary"
                            >
                              <Lightbulb
                                className="size-3.5 shrink-0"
                                style={{ color: POINT_STYLE.DEADLINE }}
                              />
                              <ContentText className="truncate">{g.title}</ContentText>
                            </Link>
                            <div className="flex shrink-0 items-center gap-2">
                              {g.lecture && (
                                <Link
                                  href={`/lectures/${g.lecture.id}`}
                                  className="text-xs text-primary hover:underline"
                                >
                                  <ContentText className="max-w-[12rem] truncate">
                                    {g.lecture.title}
                                  </ContentText>
                                </Link>
                              )}
                              <GapStatusBadge status={g.status} dict={dict} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {entry.whatIDidNotUnderstand && entry.knowledgeGaps.length === 0 && (
                      <div className="mt-3">
                        <ConvertToGapDialog
                          trainingId={entry.id}
                          suggestedTitle={entry.whatIDidNotUnderstand}
                          subjects={subjects}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </OSRowGroup>

              {courses.size === 0 && lectures.size === 0 && (
                <div className="border-t border-[oklch(100%_0_0_/_5%)]">
                  <OSEmptyState
                    title={C.nothingConnectedYet}
                    hint={C.nothingConnectedHint}
                  />
                </div>
              )}
            </OSSection>
          );
        })
      )}
    </div>
  );
}
