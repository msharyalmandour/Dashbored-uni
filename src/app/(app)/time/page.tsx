import { OSPageHeader } from "@/components/shared/os-page-header";
import { pageTitle } from "@/lib/i18n/page-title";
import { Info, AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, format } from "@/lib/i18n/dictionaries";
import {
  dayCapacity,
  remainingCapacityToday,
  summariseWorkload,
  detectCollision,
  formatMinutes,
} from "@/lib/time-intelligence";
import { WeekEditor } from "@/components/time/week-editor";
import { Card } from "@/components/ui/card";
import { TtSection, TtRow } from "@/components/shared/tt";

export const generateMetadata = pageTitle((dict) => dict.nav.items.time.label);
export const dynamic = "force-dynamic";

/**
 * Where time stops being a guess.
 *
 * The page is ordered the way the reasoning runs: here is what today has left,
 * here is whether the week fits, and here is the raw material both of those
 * came from. When the student has told the system nothing, it says so plainly
 * instead of showing a confident zero — an empty week computes to twenty-four
 * free hours a day, which is the single most misleading thing this page could
 * display.
 */
export default async function TimePage() {
  const userId = await getCurrentUserId();
  const dict = getDictionary(await getLocale());
  const t = dict.time;
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 86400000);

  const [commitments, weekTasks] = await Promise.all([
    prisma.timeCommitment.findMany({
      where: { userId },
      orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
      select: {
        id: true,
        kind: true,
        label: true,
        weekday: true,
        startMinute: true,
        endMinute: true,
      },
    }),
    prisma.task.findMany({
      where: { userId, status: { not: "COMPLETED" }, deadline: { lte: weekAhead } },
      select: {
        id: true,
        title: true,
        deadline: true,
        estimatedMinutes: true,
        completionPercentage: true,
      },
    }),
  ]);

  const today = dayCapacity(commitments, now);
  const remaining = remainingCapacityToday(commitments, now);
  const workload = summariseWorkload(weekTasks, weekAhead);
  const collision = detectCollision(remaining, workload);

  // Durations are interpolated into full sentences below, so they carry the
  // dictionary's own unit labels rather than a hardcoded Latin "h"/"m".
  const units = { hours: t.hours, minutes: t.minutes };
  const duration = (minutes: number) => formatMinutes(minutes, units);

  const VERDICT = {
    FITS: { icon: CheckCircle2, title: t.fits, body: t.fitsBody, tone: "text-success" },
    TIGHT: { icon: AlertTriangle, title: t.tight, body: t.tightBody, tone: "text-warning" },
    OVERLOADED: {
      icon: AlertTriangle,
      title: t.overloaded,
      body: format(t.overloadedBody, {
        required: duration(collision.requiredMinutes),
        available: duration(collision.availableMinutes),
        deficit: duration(collision.deficitMinutes),
      }),
      tone: "text-destructive",
    },
    UNKNOWN: { icon: HelpCircle, title: t.unknownVerdict, body: t.unknownBody, tone: "text-muted-foreground" },
  } as const;

  const verdict = VERDICT[collision.verdict];
  const VerdictIcon = verdict.icon;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <OSPageHeader title={t.pageHeading} state={t.pageSubtitle} />

      {/* Nothing recorded: ask, rather than compute from an empty table. */}
      {commitments.length === 0 ? (
        <Card variant="quiet" className="flex items-start gap-3 p-4">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">{t.setupTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t.setupBody}</p>
          </div>
        </Card>
      ) : (
        /* THREE TILES BECAME THREE ROWS.
        
           The figures are genuinely the point of this page, so they keep their
           weight — but they are three readings of ONE quantity, minutes of one
           day, and three boxes side by side asked the eye to compare across a
           gap instead of down a column. A timetable column is what comparing
           three of the same unit looks like, and the marker lands on the one
           that is a decision: what is left. */
        <TtSection title={t.todayHeading}>
          <TtRow figure={duration(today.committedMinutes)} label={t.committed} />
          <TtRow figure={duration(today.flexibleMinutes)} label={t.flexible} />
          <TtRow figure={duration(remaining.studyMinutes)} label={t.remainingToday} now />
          <TtRow>
            {/* The one assumption in the engine, said out loud rather than
                applied quietly behind a confident-looking number. */}
            <span className="tt-meta col-span-3">{t.studyTimeNote}</span>
          </TtRow>
        </TtSection>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">{t.workloadHeading}</h2>

        <Card variant="quiet" className="flex items-start gap-3 p-4">
          <VerdictIcon className={`mt-0.5 size-4 shrink-0 ${verdict.tone}`} />
          <div>
            <p className="text-sm font-medium">{verdict.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{verdict.body}</p>
          </div>
        </Card>

        {/* Unsized work is named, not folded into a total that would look
            complete and would not be. */}
        {collision.unestimatedCount > 0 && (
          <Card variant="quiet" className="flex items-start gap-3 p-4">
            <HelpCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {format(t.unestimated, { count: collision.unestimatedCount })}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{t.unestimatedBody}</p>
              <ul className="mt-2 flex flex-col gap-1">
                {workload.unestimated.slice(0, 5).map((item) => (
                  <li key={item.id} className="truncate text-xs text-muted-foreground">
                    {item.title}
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">{t.pageHeading}</h2>
        <WeekEditor commitments={commitments} />
      </section>
    </div>
  );
}
