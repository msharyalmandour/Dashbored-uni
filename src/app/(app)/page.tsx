import { getCurrentUserId } from "@/lib/current-user";
import { getDashboardData } from "@/lib/dashboard";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { resumeHrefFor } from "@/lib/resume";
import { Hero } from "@/components/home/hero";
import { TodayDoseBand } from "@/components/home/today-dose";
import { getTodayDose } from "@/lib/today-dose";
import { StuckFilesBand } from "@/components/home/stuck-files";
import { getStuckFiles } from "@/lib/stuck-files";
import { ResumeSession } from "@/components/home/resume-session";
import { LooseEnds } from "@/components/home/loose-ends";
import {
  StatsStrip, TodayCard, NextCard, ContinueStrip,
  MiniCalendar, BreathCard, QuickActions,
  type TodayRow, type NextItem, type ContinueItem,
} from "@/components/home/home-panels";
import { DropZone } from "@/components/ui/drop-zone";
import { prisma } from "@/lib/prisma";
import { courseCode } from "@/lib/course-code";
import { weightFromTitle } from "@/lib/exam-weight";
import { localeTag } from "@/lib/i18n/config";

/**
 * Home. One of them, now.
 *
 * There were two. `/` held a greeting, a question and an orb, and read the
 * whole day's data only to show a single number out of it; `/today` — labelled
 * "Dashboard" in the sidebar — held the day itself. The reasoning at the time
 * was that the two questions are asked at different rates: "what now?" every
 * day in ten seconds, "how does it all look?" every few days for a few minutes.
 *
 * That reasoning was wrong in the way that only shows up in use. A student
 * opening the app does not know which of their two homes has the thing they
 * came for, and the one named Home was the one that had almost nothing. The
 * cost of guessing wrong every time is far higher than the cost of scrolling
 * past an orb.
 *
 * So: one page. The orb stays at the top, because a way in that is always in
 * the same place is worth a band of screen. Under it is the day — which is
 * what the student actually came for, and which each card carries a door into.
 *
 * Both halves come from one `getDashboardData` call, which is what they were
 * both doing separately before.
 *
 * RE-LAID OUT TO THE APPROVED DRAWING. The sections it names, in its order:
 * the greeting, the strip of four figures, «اليوم» beside «الجاي» at 1.6 to
 * 1, then «كمّل من حيث وقفت»; and down the left, the calendar, the breather
 * and the shortcuts.
 *
 * WHAT CAME OFF THIS PAGE, and where it went, because none of it was
 * deleted from the product:
 *
 *   - `AiCommand`, the «مركز الذكاء» orb. The brief removes it from Home by
 *     name and puts it on the assistant's own page.
 *   - `DashboardView`, the long day panel. The drawing's «اليوم» card is
 *     what replaces it HERE — and /today, which had been a bare redirect to
 *     this page, renders the full panel again. It was removed from Home
 *     because the drawing does not have it, not because it stopped being
 *     worth having, and leaving it referenced by nothing would have deleted
 *     a feature under cover of a reskin.
 *   - `ExamBand`, `NextUp` and `ContinueReading`. These are what `NextCard`,
 *     `TodayCard` and `ContinueStrip` are built from — the same three facts
 *     in the places the drawing puts them, rather than three stacked bands.
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const userId = await getCurrentUserId();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const now = new Date();
  const [data, resumeHref, dose, stuck] = await Promise.all([
    getDashboardData(userId, dict),
    resumeHrefFor(userId),
    getTodayDose(userId, now),
    getStuckFiles(userId),
  ]);

  /* THE APPROVED LAYOUT'S OWN FIGURES. Reads only — the brief for this page
     says the logic and the data do not change, so nothing here writes and
     nothing recomputes what `getDashboardData` already answered. */
  const [recent, lectureProgress, nextTasks] = await Promise.all([
    /* The four most recently touched lectures, for «كمّل من حيث وقفت». */
    prisma.lecture.findMany({
      where: { subject: { userId } },
      orderBy: { updatedAt: "desc" },
      take: 4,
      select: {
        id: true,
        title: true,
        completionPercentage: true,
        subject: { select: { name: true, code: true } },
      },
    }),
    /* The one figure the strip needs that the dashboard does not already
       hold: how far through his lectures he is, averaged. A real number
       with a nameable base, not a composite score. */
    prisma.lecture.aggregate({
      where: { subject: { userId } },
      _avg: { completionPercentage: true },
      _count: true,
    }),
    prisma.task.findMany({
      where: { userId, status: { not: "COMPLETED" }, deadline: { gte: now } },
      orderBy: { deadline: "asc" },
      take: 4,
      select: {
        id: true,
        title: true,
        type: true,
        deadline: true,
        subject: { select: { name: true, code: true } },
      },
    }),
  ]);

  const hx = dict.homeExact;
  const nowMinute = now.getHours() * 60 + now.getMinutes();

  const todayRows: TodayRow[] = data.todayClasses.map((c) => ({
    id: c.id,
    title: c.title,
    kind: dict.dashboard.eventType[c.type as keyof typeof dict.dashboard.eventType] ?? c.type,
    startMinute: c.startMinute,
    minutes: c.minutes,
    location: c.location,
    /* The one he is in. `minutes` is null when the length is genuinely
       unknown, and a block with no end cannot be "now" — guessing an hour
       would ring a row that may have finished. */
    current:
      c.minutes !== null &&
      nowMinute >= c.startMinute &&
      nowMinute < c.startMinute + c.minutes,
  }));

  const dayMs = 86400000;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const nextItems: NextItem[] = nextTasks.map((task) => ({
    id: task.id,
    title: task.title,
    courseCode: task.subject ? courseCode(task.subject.name, task.subject.code) : null,
    daysAway: Math.round(
      (new Date(
        task.deadline.getFullYear(),
        task.deadline.getMonth(),
        task.deadline.getDate()
      ).getTime() -
        startOfToday) /
        dayMs
    ),
    exam: task.type === "EXAM" || task.type === "QUIZ",
    weight: weightFromTitle(task.title),
  }));

  const continueItems: ContinueItem[] = recent.map((l) => ({
    id: l.id,
    title: l.title,
    courseCode: l.subject ? courseCode(l.subject.name, l.subject.code) : null,
    percent: Math.max(0, Math.min(100, l.completionPercentage)),
    href: `/lectures/${l.id}`,
  }));

  const monthLabel = new Intl.DateTimeFormat(localeTag[locale], {
    month: "long",
    year: "numeric",
  }).format(now);
  const dateLine = new Intl.DateTimeFormat(localeTag[locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);

  return (
    <div className="flex flex-col gap-10">
      <Hero
        dict={dict}
        now={now}
        locale={locale}
        userName={data.userName}
        resumeHref={resumeHref}
      />

      {/* First under the hero, because it is the only thing on this page with
          a deadline measured in minutes. An abandoned session and a standing
          total can both wait; a clinical that starts at eight, in a hospital,
          cannot — and for a fortnight this said nothing at all, because the
          day was read from a table holding one week. See
          src/lib/today-classes.ts. */}


      {/* منع التراكم. Directly under the exam band because the two are one
          thought: the band says a midterm is close and ninety-two pages are
          unread, and this says which lectures that means tonight. A warning
          without an instruction is just pressure. */}
      <TodayDoseBand dose={dose} dict={dict} locale={locale} />

      {/* THE APPROVED LAYOUT. Main column fluid, left column 290px, 24px
          between — the numbers the brief states by name. Every panel draws
          when it is empty rather than disappearing: a page that is a
          different shape every morning is a page he stops knowing.

          The bands that used to be here — the exam call, the dose, the stuck
          files, next-up, resume, continue-reading, the AI orb — are not
          deleted; they are what these panels are built from, and the orb
          moves off Home as the brief asks. */}
      {/* PHONE ONLY, and directly under the greeting, because that is where
          the drawing puts it: the product is named after dropping a file and
          a phone has no sidebar to carry the door. The bottom bar's raised
          «ارمِ» is the same destination; this is the one that is visible
          without reaching for it. On a desktop the sidebar already holds it,
          so a second copy would be two doors to one room. */}
      <div className="hx-drop">
        <DropZone />
      </div>

      <div className="hx-grid">
        <div className="hx-main">
          <StatsStrip
            data={{
              subjects: data.activeSubjectsCount,
              exams: data.upcomingExamsCount,
              tasks: data.activeTasksCount,
              /* Null rather than 0 when there are no lectures to average:
                 "0% تقدّم المذاكرة" on an empty account is a judgement the
                 data does not support. */
              progress:
                lectureProgress._count > 0
                  ? Math.round(lectureProgress._avg.completionPercentage ?? 0)
                  : null,
            }}
            t={hx}
          />

          <div className="hx-row flex flex-col gap-6">
            <TodayCard rows={todayRows} dateLine={dateLine} t={hx} />
            <NextCard items={nextItems} locale={locale} t={hx} />
          </div>

          <ContinueStrip items={continueItems} t={hx} />

          {/* Kept below the approved panels: these read PATTERNS rather than
              rows — a file stuck in the queue, a thing abandoned mid-read —
              and each draws nothing when there is nothing to say. */}
          <StuckFilesBand files={stuck} dict={dict} />
          <TodayDoseBand dose={dose} dict={dict} locale={locale} />
          <ResumeSession userId={userId} dict={dict} />
          <LooseEnds userId={userId} dict={dict} />
        </div>

        <aside className="hx-side">
          <MiniCalendar now={now} monthLabel={monthLabel} t={hx} />
          <BreathCard minutes={25} t={hx} />
          <QuickActions t={hx} />
        </aside>
      </div>
    </div>
  );
}
