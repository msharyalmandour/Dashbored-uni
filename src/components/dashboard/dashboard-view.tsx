import { CommandHeader } from "@/components/dashboard/command-header";
import { AmbientHero } from "@/components/dashboard/ambient-hero";
import { StatTiles } from "@/components/dashboard/stat-tiles";
import { TodayCommandCenter } from "@/components/dashboard/today-command-center";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { AcademicWorlds } from "@/components/dashboard/academic-worlds";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import type { DashboardData } from "@/lib/dashboard";

/**
 * The dashboard's pure composition, split out from the page so it can be
 * fed either real fetched data (the actual route) or a fixture (local
 * visual QA) without touching auth or the data layer.
 */
export function DashboardView({
  dict,
  locale,
  now,
  data,
}: {
  dict: Dictionary;
  locale: Locale;
  now: Date;
  data: DashboardData;
}) {
  return (
    /* TWO COLUMNS, not one stack.

       This was a single vertical column: hero, day, inbox, actions, courses,
       each the full width of the page. On a 1440px screen that gives a
       five-item list of today's classes about 1,100 pixels of width to say
       "Lecture, 09:00, Room B" in, and pushes everything else below the fold —
       so the shortcuts and the courses were only ever reached by scrolling
       past the thing the student came for.

       The reference splits it: the day and the courses hold the main column,
       and the things you glance at rather than read — the shortcuts, and the
       inbox — sit in a rail beside them. Nothing moved out of reach; the page
       simply stopped being a queue.

       The rail is a fixed 320px because its contents are a calendar-width
       object and a list of short labels: let it flex and it grows to a width
       neither of them has any use for. The main column takes what is left,
       with `minmax(0,1fr)` so a long lecture title cannot push the grid wider
       than the screen — the classic cause of a page that scrolls sideways.

       Below `xl` it collapses back to one column, which is the right answer on
       a laptop: two columns of 400px each is worse than one of 800. */
    <div className="flex flex-col gap-8">
      <AmbientHero now={now}>
        <CommandHeader
          now={now}
          dict={dict}
          locale={locale}
          // Was a random pick from five generic encouragements, which said
          // the same thing on a quiet Tuesday and the morning of three
          // deadlines. This is derived from the same real numbers the rest
          // of the page uses.
          tagline={dict.today.situation[data.situation.situation]}
          todayProgress={data.todayProgress}
        />
        <StatTiles
          dict={dict}
          tasksDueToday={data.todayProgress.tasksDueToday}
          daysToExam={data.nextExamDaysAway}
        />
      </AmbientHero>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <TodayCommandCenter dict={dict} locale={locale} data={data} now={now} />
          <AcademicWorlds dict={dict} locale={locale} data={data} now={now} />
        </div>

        {/* `xl:sticky` so the shortcuts stay reachable while the day is
            scrolled. `top-20` clears the 64px sticky header rather than
            sliding under it. */}
        <aside className="flex min-w-0 flex-col gap-6 xl:sticky xl:top-20">
          <QuickActions dict={dict} />
          {/* The inbox band was here. It is gone with the queue it pointed at:
              on the real account that queue held eleven rows and every one of
              them was an error, so the band's job was to tell the student how
              many times the app had failed him and invite him to go and look.
              See src/app/(app)/inbox/page.tsx. */}
        </aside>
      </div>
    </div>
  );
}
