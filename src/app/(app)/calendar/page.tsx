import { OSPageHeader } from "@/components/shared/os-page-header";
import { pageTitle } from "@/lib/i18n/page-title";
import Link from "next/link";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  format,
  isSameMonth,
  isToday,
  startOfDay,
  endOfDay,
} from "date-fns";
import { getCurrentUserId } from "@/lib/current-user";
import { getCalendarEvents, type CalendarEvent } from "@/lib/calendar";
import { CalendarNav } from "@/components/calendar/calendar-nav";
import { EventChip, CalendarLegend } from "@/components/calendar/event-chip";
import { cn, formatDayMonth, formatMonthYear, formatWeekdayDay } from "@/lib/utils";
import { localeTag } from "@/lib/i18n/config";
import { loadWeekMap } from "@/lib/week-data";
import { startOfWeek as weekMapStart } from "@/lib/week-map";
import { WeekTimeline } from "@/components/week/week-timeline";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, format as formatDict, type Dictionary } from "@/lib/i18n/dictionaries";

export const generateMetadata = pageTitle((dict) => dict.nav.items.calendar.label);

type ViewType = "month" | "week" | "day";

function hrefFor(view: ViewType, date: Date) {
  return `/calendar?view=${view}&date=${format(date, "yyyy-MM-dd")}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const sp = await searchParams;
  const userId = await getCurrentUserId();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const view: ViewType = sp.view === "week" || sp.view === "day" ? sp.view : "month";
  const refDate = sp.date ? new Date(sp.date) : new Date();

  if (view === "month") {
    const monthStart = startOfMonth(refDate);
    const monthEnd = endOfMonth(refDate);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = endOfWeek(monthEnd);
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
    const events = await getCalendarEvents(userId, gridStart, gridEnd);

    const eventsByDay = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = format(new Date(e.date), "yyyy-MM-dd");
      const list = eventsByDay.get(key) ?? [];
      list.push(e);
      eventsByDay.set(key, list);
    }

    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

    return (
      <div className="flex flex-col gap-5">
        <Header dict={dict} />
        <CalendarNav
          view={view}
          label={formatMonthYear(refDate, locale)}
          prevHref={hrefFor("month", subMonths(refDate, 1))}
          nextHref={hrefFor("month", addMonths(refDate, 1))}
          todayHref={hrefFor("month", new Date())}
          dict={dict}
        />
        <CalendarLegend dict={dict} />
        {/* The month grid carries its own opaque ground, for the same reason the
            week grid does: every surface in this app floats over a photograph,
            and `bg-muted/40` over a forest is a forest. Thirty-five cells of
            small text is the last place that can be left translucent. */}
        <div className="overflow-hidden rounded-xl border border-border bg-[#1A1815]">
          <div className="grid grid-cols-7 border-b border-border bg-[oklch(100%_0_0_/_4%)] text-center text-xs font-medium text-muted-foreground">
            {dict.calendar.weekdays.map((d) => (
              <div key={d} className="py-2">{d}</div>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-border last:border-b-0">
              {week.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayEvents = eventsByDay.get(key) ?? [];
                return (
                  <div
                    key={key}
                    className={cn(
                      "flex min-h-28 flex-col gap-1 border-e border-border p-1.5 last:border-e-0 hover:bg-[oklch(100%_0_0_/_5%)]",
                      // A day outside this month recedes by going darker than
                      // the grid, not by going translucent over it.
                      !isSameMonth(day, refDate) && "bg-[oklch(0%_0_0_/_28%)] text-muted-foreground/50"
                    )}
                  >
                    <Link href={hrefFor("day", day)} className="w-fit">
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full text-xs hover:ring-2 hover:ring-primary/30",
                          isToday(day) && "bg-primary font-semibold text-primary-foreground"
                        )}
                      >
                        {format(day, "d")}
                      </span>
                    </Link>
                    <div className="flex flex-col gap-0.5">
                      {dayEvents.slice(0, 3).map((e) => (
                        <EventChip key={e.id} event={e} />
                      ))}
                      {dayEvents.length > 3 && (
                        <Link
                          href={hrefFor("day", day)}
                          className="px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          {formatDict(dict.calendar.moreCount, { count: dayEvents.length - 3 })}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === "week") {
    // The week is a timeline, not seven lists. Seven boxes of chips answered
    // "what is on Tuesday" and never "when", which is the only question a
    // student opens a week view to ask — a class that runs four hours looked
    // exactly like a fifteen-minute one.
    const weekStart = weekMapStart(refDate);
    const weekEnd = endOfWeek(refDate);
    const map = await loadWeekMap(userId, weekStart, dict.calendar.legend.reviews);

    return (
      <div className="flex flex-col gap-5">
        <Header dict={dict} />
        <CalendarNav
          view={view}
          label={`${formatDayMonth(weekStart, locale)} – ${formatDayMonth(weekEnd, locale)}`}
          prevHref={hrefFor("week", subWeeks(refDate, 1))}
          nextHref={hrefFor("week", addWeeks(refDate, 1))}
          todayHref={hrefFor("week", new Date())}
          dict={dict}
        />
        <CalendarLegend dict={dict} />
        <WeekTimeline
          map={map}
          dayNames={map.days.map((d) => formatWeekdayDay(d.date, locale))}
          labels={{
            now: dict.calendar.today,
            nothing: dict.calendar.nothingThisWeek,
            unplaced: dict.calendar.unplacedWork,
            noEstimate: dict.calendar.noEstimate,
            overdue: dict.calendar.overdue,
          }}
        />
      </div>
    );
  }

  // day view
  const dayStart = startOfDay(refDate);
  const dayEnd = endOfDay(refDate);
  const events = await getCalendarEvents(userId, dayStart, dayEnd);

  return (
    <div className="flex flex-col gap-5">
      <Header dict={dict} />
      <CalendarNav
        view={view}
        label={refDate.toLocaleDateString(localeTag[locale], { weekday: "long", month: "long", day: "numeric" })}
        prevHref={hrefFor("day", subDays(refDate, 1))}
        nextHref={hrefFor("day", addDays(refDate, 1))}
        todayHref={hrefFor("day", new Date())}
        dict={dict}
      />
      <CalendarLegend dict={dict} />
      <div className="flex flex-col gap-2">
        {events.length === 0 && (
          <p className="rounded-lg border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
            {dict.calendar.nothingScheduled}
          </p>
        )}
        {events.map((e) => (
          <Link
            key={e.id}
            href={e.href}
            className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 hover:border-primary/40"
          >
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
            <span className="w-16 shrink-0 text-xs text-muted-foreground">{format(new Date(e.date), "h:mm a")}</span>
            <span className="text-sm font-medium">{e.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Header({ dict }: { dict: Dictionary }) {
  return (
    <OSPageHeader title={dict.calendar.title} state={dict.calendar.subtitle} />
  );
}
