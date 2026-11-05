"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { pick, pluralForm } from "@/lib/i18n/plural";
import { Chip, IconButton, Segmented } from "@/components/ui/controls";
import { TutorOrb } from "@/components/ui/progress-ring";
import {
  GRID_START,
  HOUR_PX,
  WEEK_DAYS,
  gridHeight,
  hourMarks,
  isNow,
  laneOf,
  nowOffset,
  place,
  serverMoment,
} from "@/lib/week-grid";
import type { WeekScreen, WeekSlot, WeekTask } from "@/lib/week-store";
import type { Locale } from "@/lib/i18n/config";

/**
 * أسبوعي — the week as a board you can point at.
 *
 * ONE SCREEN, FIVE COLUMNS, NINE HOURS. Every position on it comes out of
 * src/lib/week-grid.ts, which has its own guard; nothing here does arithmetic
 * on a minute. What is here is the part that only exists once it is drawn:
 * which column is today, what a block looks like while he is sitting in it,
 * and what happens when he presses one.
 *
 * THE PRESS IS THE POINT. A timetable that only shows times is a photograph
 * of a timetable, and he already has one of those on his phone. Pressing a
 * block dims the rest of the week and runs a dotted line to a panel holding
 * the work attached to that course — which is the whole claim of this
 * product: the timetable is where everything else hangs.
 *
 * WESTERN DIGITS, ARABIC WORDS. src/lib/i18n/config.ts settled this for the
 * whole app: `ar` and not `ar-SA`, because one card showing ٢٢ beside a count
 * showing 12 is worse than either choice made consistently. The design canvas
 * draws ٨:٠٠; the app says 8:00 everywhere, so this says 8:00 too.
 *
 * MOBILE IS ONE DAY, NOT FIVE SQUEEZED. Five columns at 390px is 62px a
 * column, which cannot hold "NURC 410" let alone a badge. So the phone gets a
 * day strip and one column at full width — the same blocks, readable.
 */

export interface BoardStrings {
  heading: string;
  sub: string;
  now: string;
  today: string;
  pickDay: string;
  tapHint: string;
  linkedHeading: string;
  nothingLinked: string;
  close: string;
  openCourse: string;
  dueHeading: string;
  nothingDue: string;
  monthHeading: string;
  overdue: string;
  dueToday: string;
  dueTomorrow: string;
  inDays: Record<string, string>;
  tasksDue: Record<string, string>;
  lecturesOpen: Record<string, string>;
  ready: Record<string, string>;
  tutorQuiet: string;
  tutorDue: string;
  tutorLate: string;
  monthDeadlines: string;
  monthExams: string;
}

/** "8:00 – 10:50", in the app's digits. */
function range(startMinute: number, endMinute: number): string {
  const hhmm = (m: number) =>
    `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
  return `${hhmm(startMinute)} – ${hhmm(endMinute)}`;
}

function countPhrase(bag: Record<string, string>, count: number, locale: Locale): string {
  return pick(bag, pluralForm(locale, count)).replace("{count}", String(count));
}

/** How a deadline reads: late, today, tomorrow, or a number of days. */
function when(task: WeekTask, t: BoardStrings, locale: Locale): { text: string; late: boolean } {
  if (task.daysLeft < 0) return { text: t.overdue, late: true };
  if (task.daysLeft === 0) return { text: t.dueToday, late: true };
  if (task.daysLeft === 1) return { text: t.dueTomorrow, late: false };
  return { text: countPhrase(t.inDays, task.daysLeft, locale), late: false };
}

export function WeekBoard({
  screen,
  nowMinute,
  nowWeekday,
  locale,
  t,
  weekdayNames,
  weekdayShort,
  kindNames,
}: {
  screen: WeekScreen;
  /** Minutes from midnight, computed on the SERVER so the first paint agrees. */
  nowMinute: number;
  nowWeekday: number;
  locale: Locale;
  t: BoardStrings;
  weekdayNames: readonly string[];
  /* The strip's own names. "الأربعاء" five times across 390px is 450px of
     tabs, which pushed the whole board sideways until it was measured. */
  weekdayShort: readonly string[];
  kindNames: Record<string, string>;
}) {
  /* The phone opens on today when today is a university day, and on Sunday
     when it is Friday or Saturday — an empty column is a worse first screen
     than the start of the week. */
  const [day, setDay] = React.useState<string>(
    String(WEEK_DAYS.includes(nowWeekday as 0) ? nowWeekday : WEEK_DAYS[0])
  );
  const [picked, setPicked] = React.useState<string | null>(null);

  /* The server owns what day it is; see `serverMoment`, which is guarded in
     scripts/verify-week-grid.ts. */
  const now = React.useMemo(
    () => serverMoment(nowWeekday, nowMinute, new Date()),
    [nowMinute, nowWeekday]
  );

  const height = gridHeight();
  const line = nowOffset(now);
  const selected = screen.slots.find((s) => s.id === picked) ?? null;

  /* A TASK THAT IS ALREADY LATE IS NOT "DUE THIS WEEK".
     Oct 25 and Nov 8 are both inside the seven-day window this screen reads,
     and telling him "you have two tasks before the week is out" when one of
     them went past eleven days ago is the kind of soft wrong that makes a
     student stop reading the line. Late is said first, and said as late. */
  const late = screen.dueThisWeek.filter((task) => task.daysLeft < 0).length;
  const ahead = screen.dueThisWeek.length - late;
  const tutorLine =
    late > 0
      ? t.tutorLate.replace("{due}", countPhrase(t.tasksDue, late, locale))
      : ahead > 0
        ? t.tutorDue.replace("{due}", countPhrase(t.tasksDue, ahead, locale))
        : t.tutorQuiet;

  return (
    <section className="c-ground wk-board rounded-[28px] p-4 sm:p-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="t-kufi m-0 text-[22px] font-extrabold text-[color:var(--cream)]">
            {t.heading}
          </h2>
          <p className="m-0 text-[12px]" style={{ color: "var(--sec)" }}>
            {t.sub}
          </p>
        </div>
        <p className="m-0 hidden text-[12px] sm:block" style={{ color: "var(--sec)" }}>
          {t.tapHint}
        </p>
      </header>

      {/* The day strip. It only exists on a narrow screen, where five columns
          do not fit — and it is a real tablist, so it is reachable by keyboard
          on the tablet too. */}
      <div className="wk-strip mt-4">
        <Segmented
          ariaLabel={t.pickDay}
          value={day}
          onChange={setDay}
          options={WEEK_DAYS.map((d) => ({
            value: String(d),
            label: weekdayShort[d] ?? weekdayNames[d] ?? String(d),
          }))}
          className="w-full"
        />
      </div>

      <div className={cn("wk-layout mt-4", selected && "wk-layout-picked")}>
        <div className="wk-grid">
          {/* The hour rail. `aria-hidden`: a screen reader reading "8 9 10 11"
              before the classes is noise, and every block carries its own
              hours in its own label. */}
          <div aria-hidden className="wk-rail" style={{ height }}>
            {hourMarks().map((h) => (
              <span
                key={h}
                className="t-figure wk-hour"
                style={{ top: ((h * 60 - GRID_START) / 60) * HOUR_PX }}
              >
                {h}
              </span>
            ))}
          </div>

          {/* The hour lines, one per hour, behind everything. */}
          <div aria-hidden className="wk-lines" style={{ height }}>
            {hourMarks()
              .slice(1)
              .map((h) => (
                <span
                  key={h}
                  className="wk-line"
                  style={{ top: ((h * 60 - GRID_START) / 60) * HOUR_PX }}
                />
              ))}
          </div>

          <div className="wk-days">
            {WEEK_DAYS.map((d) => {
              const today = d === nowWeekday;
              const slots = screen.slots.filter((s) => s.weekday === d);
              return (
                <div
                  key={d}
                  className={cn("wk-col", today && "wk-col-today")}
                  data-day={d}
                  data-shown={String(d) === day}
                >
                  <div className="wk-head">
                    <span className="t-kufi wk-head-day">{weekdayNames[d] ?? d}</span>
                    {today && (
                      <span className="wk-head-now t-figure">{t.today}</span>
                    )}
                  </div>

                  <div className="wk-track" style={{ height }}>
                    {/* The now line, inside today's column only. Drawn here
                        rather than across the whole grid because "you are
                        here" is about a day as much as an hour. */}
                    {today && line !== null && (
                      <span aria-hidden className="wk-now" style={{ top: line }} />
                    )}

                    {slots.map((slot) => (
                      <Block
                        key={slot.id}
                        slot={slot}
                        all={screen.slots}
                        now={now}
                        t={t}
                        locale={locale}
                        kindNames={kindNames}
                        selected={picked === slot.id}
                        dimmed={picked !== null && picked !== slot.id}
                        onPick={() => setPicked(picked === slot.id ? null : slot.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* The side. On a wide screen it holds the panel when a block is
            picked, and otherwise the week's own summary; on a phone both of
            those sit under the grid. */}
        <aside className="wk-side">
          {selected ? (
            <LinkedPanel
              slot={selected}
              t={t}
              locale={locale}
              kindNames={kindNames}
              onClose={() => setPicked(null)}
            />
          ) : (
            <>
              <div className="wk-card">
                <h3 className="t-kufi m-0 text-[15px] font-bold text-[color:var(--cream)]">
                  {t.dueHeading}
                </h3>
                {screen.dueThisWeek.length === 0 ? (
                  <p className="m-0 mt-1 text-[12px]" style={{ color: "var(--sec)" }}>
                    {t.nothingDue}
                  </p>
                ) : (
                  <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
                    {screen.dueThisWeek.slice(0, 6).map((task) => {
                      const w = when(task, t, locale);
                      return (
                        <li key={task.id} className="flex min-w-0 items-baseline justify-between gap-2">
                          {/* `dir="auto"` — without it an English title sits
                              inside an RTL line and the ellipsis eats its
                              START: "…ng (group work) + Quality checklist".
                              The half that identifies the task is the half
                              that was being thrown away. */}
                          <span
                            dir="auto"
                            className="min-w-0 flex-1 truncate text-[13px] text-[color:var(--cream)]"
                          >
                            {task.title}
                          </span>
                          <Chip tone={w.late ? "danger" : "warm"}>{w.text}</Chip>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <MonthStrip marked={screen.marked} t={t} />

              <div className="wk-card flex items-start gap-3">
                <TutorOrb size={44} floaty />
                <p className="m-0 text-[13px]" style={{ color: "var(--sec-2)" }}>
                  {tutorLine}
                </p>
              </div>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}

/**
 * One class on the grid.
 *
 * A BUTTON, because it is pressed. A div with onClick is unreachable by Tab,
 * and the whole panel behind it would then be mouse-only.
 *
 * The label read out loud is the whole row — day is implied by the column for
 * someone looking, and not at all for someone listening, so the hours and the
 * course go in the accessible name together.
 */
function Block({
  slot,
  all,
  now,
  t,
  locale,
  kindNames,
  selected,
  dimmed,
  onPick,
}: {
  slot: WeekSlot;
  all: WeekSlot[];
  now: Date;
  t: BoardStrings;
  locale: Locale;
  kindNames: Record<string, string>;
  selected: boolean;
  dimmed: boolean;
  onPick: () => void;
}) {
  const box = place(slot);
  const { lane, lanes } = laneOf(slot, all);
  const live = isNow(slot, now);
  const accent = slot.world.one;

  /* WHAT FITS, MEASURED AGAINST THE BLOCK'S OWN HEIGHT.
  
     A 50-minute class is 66px tall and the four lines this block wants to
     draw are 54px plus padding — so the last one is sliced in half, which is
     what "Critical Care Nursin—" looked like on the first render. Below 96px
     the name goes and the CODE carries the identity, because "NURC 411" in
     ten characters says what "Critical Care…" cut in half does not. A course
     with no code keeps its name on one line instead: Elective Course has
     nothing else to be called. */
  const compact = box.height < 96;
  const showName = !compact || !slot.code;

  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      className={cn("wk-block c-press", live && "wk-block-now", selected && "wk-block-on")}
      style={{
        top: box.top,
        height: box.height,
        insetInlineStart: `${(lane / lanes) * 100}%`,
        width: `calc(${100 / lanes}% - 4px)`,
        borderInlineStartColor: accent,
        background: `color-mix(in oklab, ${accent} 16%, var(--glass))`,
        opacity: dimmed ? 0.3 : 1,
        boxShadow: live ? `0 0 0 1px ${accent}, 0 10px 30px -12px ${accent}` : undefined,
      }}
    >
      <span className="wk-block-top">
        {slot.code && <span className="t-figure wk-code">{slot.code}</span>}
        {live && <span className="wk-live t-kufi">{t.now}</span>}
      </span>
      {showName && (
        <span className="t-kufi wk-name" style={{ WebkitLineClamp: compact ? 1 : 2 }}>
          {slot.name}
        </span>
      )}
      <span className="t-figure wk-time">{range(slot.startMinute, slot.endMinute)}</span>
      {box.height >= 110 && (
        <span className="wk-kind">{kindNames[slot.kind] ?? slot.kind}</span>
      )}
      {/* Badges, and only when the block is tall enough to hold one without
          covering its own hours. A badge drawn over the time is worse than no
          badge: the time is the thing he came for. */}
      {box.height >= 140 && slot.tasks.length > 0 && (
        <span className="wk-badges">
          <Chip tone="warm">{countPhrase(t.tasksDue, slot.tasks.length, locale)}</Chip>
        </span>
      )}
    </button>
  );
}

/**
 * What is tied to the class he pressed.
 *
 * THE DOTTED LINE IS NOT DECORATION. It is the only thing on the screen that
 * says these cards came from that block and not from the week in general —
 * without it the panel reads as a second, unrelated list.
 *
 * The cards tilt (`c-tilt`) and nothing else on the page does, which is how a
 * reader knows this layer is on top. It is off under prefers-reduced-motion,
 * where the dim and the dotted line still carry the relation.
 */
function LinkedPanel({
  slot,
  t,
  locale,
  kindNames,
  onClose,
}: {
  slot: WeekSlot;
  t: BoardStrings;
  locale: Locale;
  kindNames: Record<string, string>;
  onClose: () => void;
}) {
  const accent = slot.world.one;
  const nothing = slot.tasks.length === 0 && slot.lecturesOpen === 0 && slot.lecturesReady === 0;

  return (
    <div className="wk-panel" style={{ borderColor: `color-mix(in oklab, ${accent} 40%, transparent)` }}>
      <span aria-hidden className="wk-connector" style={{ borderColor: accent }} />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="m-0 text-[11px]" style={{ color: "var(--sec)" }}>
            {t.linkedHeading}
          </p>
          <h3 className="t-kufi m-0 mt-0.5 text-[17px] font-bold text-[color:var(--cream)]">
            {slot.name}
          </h3>
          <p className="t-figure m-0 text-[12px]" style={{ color: "var(--sec-2)" }}>
            {range(slot.startMinute, slot.endMinute)}
            {slot.code ? ` · ${slot.code}` : ""}
          </p>
          <p className="m-0 text-[12px]" style={{ color: "var(--sec)" }}>
            {kindNames[slot.kind] ?? slot.kind}
          </p>
        </div>
        <IconButton label={t.close} onClick={onClose}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </IconButton>
      </div>

      {nothing ? (
        <p className="m-0 mt-3 text-[13px]" style={{ color: "var(--sec)" }}>
          {t.nothingLinked}
        </p>
      ) : (
        <div className="c-stagger mt-3 flex flex-col gap-2">
          {slot.tasks.map((task) => {
            const w = when(task, t, locale);
            return (
              <div key={task.id} className="wk-link c-tilt c-pop">
                <span dir="auto" className="min-w-0 text-[13px] text-[color:var(--cream)]">
                  {task.title}
                </span>
                <Chip tone={w.late ? "danger" : "warm"}>{w.text}</Chip>
              </div>
            );
          })}
          {slot.lecturesReady > 0 && (
            <div className="wk-link c-tilt c-pop">
              <span className="text-[13px] text-[color:var(--cream)]">
                {countPhrase(t.ready, slot.lecturesReady, locale)}
              </span>
            </div>
          )}
          {slot.lecturesOpen > 0 && (
            <div className="wk-link c-tilt c-pop">
              <span className="text-[13px] text-[color:var(--cream)]">
                {countPhrase(t.lecturesOpen, slot.lecturesOpen, locale)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* A real course row, so the panel is a way in and not a dead end. The
          block's subjectId falls back to its own row id when the commitment
          has no course, and a link to that would 404 — so it is only drawn
          when the two differ. */}
      {slot.subjectId !== slot.id && (
        <Link href={`/subjects/${slot.subjectId}`} className="c-btn-ghost c-press mt-3 inline-flex">
          {t.openCourse}
        </Link>
      )}
    </div>
  );
}

/**
 * The month, as the days that carry something.
 *
 * NOT A CALENDAR WIDGET. A full month grid in a 300px column is 42 cells of
 * four-pixel type, and nothing on it is readable or pressable. What he needs
 * from a month here is "which days have something on them", so that is what
 * is drawn.
 *
 * TWO LABELLED ROWS, NOT ONE ROW IN TWO COLOURS. An exam day and a hand-in
 * day told apart by hue alone is an icon without its word — the rule this
 * design system states twice — and it is also invisible to anyone who cannot
 * separate the two hues. So each row says what its days are.
 */
function MonthStrip({
  marked,
  t,
}: {
  marked: { day: number; exam: boolean }[];
  t: BoardStrings;
}) {
  const exams = marked.filter((m) => m.exam);
  const deadlines = marked.filter((m) => !m.exam);
  if (marked.length === 0) return null;

  return (
    <div className="wk-card">
      <h3 className="t-kufi m-0 text-[15px] font-bold text-[color:var(--cream)]">
        {t.monthHeading}
      </h3>
      {[
        { label: t.monthExams, days: exams, exam: true },
        { label: t.monthDeadlines, days: deadlines, exam: false },
      ]
        .filter((row) => row.days.length > 0)
        .map((row) => (
          <div key={row.label} className="mt-2">
            <span className="text-[11px]" style={{ color: "var(--sec)" }}>
              {row.label}
            </span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {row.days.map((m) => (
                <span
                  key={m.day}
                  className={cn("t-figure wk-day", row.exam && "wk-day-exam")}
                >
                  {m.day}
                </span>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
