import Link from "next/link";
import { GraduationCap, BookOpen, Stethoscope, Layers, CheckSquare, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { format, type Dictionary } from "@/lib/i18n/dictionaries";
import type { DashboardData } from "@/lib/dashboard";
import { formatDate } from "@/lib/utils";

/**
 * Real modules presented as distinct places, not another row of identical
 * tiles: Academics gets width (it has the most to show), Notes/Lectures is
 * an unboxed editorial moment rather than a card, and Clinical/Learn/
 * Planning are compact status panels with their own module accent. Every
 * number here comes from getDashboardData — nothing is invented for show.
 */
export function AcademicWorlds({ dict, data }: { dict: Dictionary; data: DashboardData }) {
  const w = dict.dashboard.worlds;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-semibold tracking-tight">{w.title}</h2>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card variant="quiet" className="lg:col-span-2">
          <CardContent className="flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <GraduationCap className="size-4 text-module-academics" /> {w.academics}
              </p>
              <Link href="/academics" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                {w.viewAllSubjects} <ArrowRight className="size-3 rtl:rotate-180" />
              </Link>
            </div>

            {data.subjectWorld.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{w.academicsEmpty}</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {data.subjectWorld.map((s) => (
                  <Link
                    key={s.id}
                    href={`/subjects/${s.id}`}
                    className="hover-elevate flex flex-col gap-2 rounded-lg border border-transparent bg-surface-elevated/50 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 truncate text-sm font-medium">
                        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="truncate">{s.name}</span>
                      </span>
                      {s.unresolvedGaps > 0 && (
                        <Badge variant="warning" className="shrink-0">
                          {s.unresolvedGaps}
                        </Badge>
                      )}
                    </div>
                    <Progress value={s.avgCompletion} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes & Lectures — deliberately borderless: a moment, not a card. */}
        <div className="flex flex-col justify-center gap-2 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <BookOpen className="size-4 text-module-notes" /> {w.notes}
          </p>
          {data.lectureWorld ? (
            <>
              <p className="text-xs text-muted-foreground">
                {w.continueLecture} · {data.lectureWorld.subjectName}
              </p>
              <p className="font-display text-lg font-semibold leading-snug">{data.lectureWorld.title}</p>
              <p className="text-xs text-muted-foreground">
                {data.lectureWorld.completionPercentage}% · {format(w.slidesCount, { count: data.lectureWorld.slideCount })}
              </p>
              <Link
                href={`/lectures/${data.lectureWorld.id}/slides`}
                className="mt-1 flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                {w.openSlides} <ArrowRight className="size-3.5 rtl:rotate-180" />
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{w.notesEmpty}</p>
              <Link href="/academics" className="mt-1 flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline">
                {dict.academics.title} <ArrowRight className="size-3.5 rtl:rotate-180" />
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card variant="quiet">
          <CardContent className="flex flex-col gap-3 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Stethoscope className="size-4 text-module-clinical" /> {w.clinical}
            </p>
            {data.clinicalWorld.totalEntries === 0 ? (
              <p className="text-sm text-muted-foreground">{w.clinicalEmpty}</p>
            ) : (
              <>
                <div className="flex gap-4 text-sm">
                  <div>
                    <p className="font-display text-xl font-semibold">{data.clinicalWorld.totalEntries}</p>
                    <p className="text-xs text-muted-foreground">{w.entries}</p>
                  </div>
                  <div>
                    <p className="font-display text-xl font-semibold">{data.clinicalWorld.totalCases}</p>
                    <p className="text-xs text-muted-foreground">{w.casesSeen}</p>
                  </div>
                </div>
                {data.clinicalWorld.latestEntry?.reflection && (
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {w.latestReflection}: {data.clinicalWorld.latestEntry.reflection}
                  </p>
                )}
                {data.clinicalWorld.latestEntry && (
                  <p className="text-xs text-muted-foreground">{formatDate(data.clinicalWorld.latestEntry.date)}</p>
                )}
              </>
            )}
            <Link href="/clinical" className="mt-auto flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline">
              {w.openClinical} <ArrowRight className="size-3.5 rtl:rotate-180" />
            </Link>
          </CardContent>
        </Card>

        <Card variant="quiet">
          <CardContent className="flex flex-col gap-3 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Layers className="size-4 text-module-learn" /> {w.learn}
            </p>
            <div className="flex gap-4 text-sm">
              <div>
                <p className="font-display text-xl font-semibold">{data.flashcardsDueCount}</p>
                <p className="text-xs text-muted-foreground">{w.dueFlashcards}</p>
              </div>
              <div>
                <p className="font-display text-xl font-semibold">{data.gapsSummary.unresolved}</p>
                <p className="text-xs text-muted-foreground">{dict.dashboard.unresolved}</p>
              </div>
            </div>
            <Link href="/flashcards" className="mt-auto flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline">
              {w.openFlashcards} <ArrowRight className="size-3.5 rtl:rotate-180" />
            </Link>
          </CardContent>
        </Card>

        <Card variant="quiet">
          <CardContent className="flex flex-col gap-3 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <CheckSquare className="size-4 text-module-planning" /> {w.planning}
            </p>
            <div className="flex gap-4 text-sm">
              <div>
                <p className="font-display text-xl font-semibold">{data.activeTasksCount}</p>
                <p className="text-xs text-muted-foreground">{w.activeTasks}</p>
              </div>
              <div>
                <p className="font-display text-xl font-semibold">{data.todayProgress.focusMinutesToday}</p>
                <p className="text-xs text-muted-foreground">{dict.dashboard.minStudiedToday}</p>
              </div>
            </div>
            <Link href="/tasks" className="mt-auto flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline">
              {w.openTasks} <ArrowRight className="size-3.5 rtl:rotate-180" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
