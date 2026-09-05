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
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  endOfDay,
} from "date-fns";
import { getCurrentUserId } from "@/lib/current-user";
import { getCalendarEvents, type CalendarEvent } from "@/lib/calendar";
import { CalendarNav } from "@/components/calendar/calendar-nav";
import { EventChip, CalendarLegend } from "@/components/calendar/event-chip";
import { cn } from "@/lib/utils";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, format as formatDict, type Dictionary } from "@/lib/i18n/dictionaries";

export const metadata = { title: "Calendar" };

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
  const dict = getDictionary(await getLocale());
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
          label={format(refDate, "MMMM yyyy")}
          prevHref={hrefFor("month", subMonths(refDate, 1))}
          nextHref={hrefFor("month", addMonths(refDate, 1))}
          todayHref={hrefFor("month", new Date())}
          dict={dict}
        />
        <CalendarLegend dict={dict} />
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-xs font-medium text-muted-foreground">
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
                      "flex min-h-28 flex-col gap-1 border-e border-border p-1.5 last:border-e-0 hover:bg-muted/30",
                      !isSameMonth(day, refDate) && "bg-muted/20 text-muted-foreground/50"
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
    const weekStart = startOfWeek(refDate);
    const weekEnd = endOfWeek(refDate);
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const events = await getCalendarEvents(userId, weekStart, weekEnd);

    return (
      <div className="flex flex-col gap-5">
        <Header dict={dict} />
        <CalendarNav
          view={view}
          label={`${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`}
          prevHref={hrefFor("week", subWeeks(refDate, 1))}
          nextHref={hrefFor("week", addWeeks(refDate, 1))}
          todayHref={hrefFor("week", new Date())}
          dict={dict}
        />
        <CalendarLegend dict={dict} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {days.map((day) => {
            const dayEvents = events.filter((e) => isSameDay(new Date(e.date), day));
            return (
              <div key={day.toISOString()} className={cn("flex flex-col gap-2 rounded-lg border border-border p-3", isToday(day) && "border-primary/50")}>
                <p className={cn("text-xs font-semibold", isToday(day) && "text-primary")}>
                  {format(day, "EEE d")}
                </p>
                <div className="flex flex-col gap-1">
                  {dayEvents.length === 0 && <p className="text-xs text-muted-foreground/60">—</p>}
                  {dayEvents.map((e) => (
                    <EventChip key={e.id} event={e} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
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
        label={format(refDate, "EEEE, MMMM d")}
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
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight">{dict.calendar.title}</h1>
      <p className="text-sm text-muted-foreground">{dict.calendar.subtitle}</p>
    </div>
  );
}
