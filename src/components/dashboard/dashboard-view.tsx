import { CommandHeader } from "@/components/dashboard/command-header";
import { AmbientHero } from "@/components/dashboard/ambient-hero";
import { TodayCommandCenter } from "@/components/dashboard/today-command-center";
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
    <div className="flex flex-col gap-8">
      <AmbientHero now={now}>
        <CommandHeader
          now={now}
          dict={dict}
          locale={locale}
          userName={data.userName}
          topRecommendation={data.recommendations[0]}
          focusMinutesToday={data.todayProgress.focusMinutesToday}
          tasksDueToday={data.todayProgress.tasksDueToday}
        />
      </AmbientHero>

      <TodayCommandCenter dict={dict} data={data} now={now} />

      <AcademicWorlds dict={dict} data={data} />
    </div>
  );
}
