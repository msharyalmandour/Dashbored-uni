"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { pick, pluralForm } from "@/lib/i18n/plural";
import { Chip } from "@/components/ui/controls";
import { ProgressRing } from "@/components/ui/progress-ring";
import { DropZone } from "@/components/ui/drop-zone";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { updateTaskStatus } from "@/app/actions/tasks";
import { shortCourseName } from "@/lib/course-code";
import { bucketTasks, columnVaries, daysUntil, timeKnown } from "@/lib/task-buckets";
import type { Locale } from "@/lib/i18n/config";

/**
 * المهام — four piles and the columns that earn their width.
 *
 * THE COLUMNS ARE CHOSEN BY THE DATA, NOT BY THE DESIGN. The reference asks
 * for six: المهمة · المادة · جاية من · الموعد · الأولوية · الوقت. Measured
 * on this account, three of those carry ONE value across all fifteen rows —
 * priority is MEDIUM on every task, every task was typed by hand, and not
 * one of the fifteen has an estimated time. A column with a single value in
 * it costs width on a phone and tells him nothing.
 *
 * So they are hidden by what the data does rather than cut from the design:
 * `columnVaries` puts each one back the moment a second value appears, and
 * the empty "الوقت" is not hidden at all — it is the one whose absence is
 * actionable, so it says so and offers the action.
 *
 * NOT A <table>. A six-column table at 390px is a horizontal scrollbar, and
 * the reference's own rule is that nothing scrolls sideways. Each row is a
 * grid that collapses to two lines on a phone — the same columns, stacked.
 */

export interface BoardTask {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  deadline: Date;
  estimatedMinutes: number | null;
  subjectName: string | null;
  subjectId: string | null;
  /** True when the agent filed it from something he dropped. */
  fromDrop: boolean;
}

export interface BoardStrings {
  overdue: string;
  thisWeek: string;
  later: string;
  done: string;
  markDone: string;
  markNotDone: string;
  colTask: string;
  colSubject: string;
  colFrom: string;
  colDue: string;
  colPriority: string;
  colTime: string;
  fromManual: string;
  fromDrop: string;
  noEstimate: string;
  setEstimate: string;
  dueToday: string;
  dueTomorrow: string;
  lateBy: string;
  emptyOverdue: string;
  emptyThisWeek: string;
  emptyLater: string;
  emptyDone: string;
  todayHeading: string;
  todayLabel: string;
  cannotPlanHeading: string;
  cannotPlanBody: string;
  canPlanBody: string;
  sourcesHeading: string;
  sourceDrop: string;
  sourceYou: string;
  dropHeading: string;
  dropHint: string;
  taskCount: Record<string, string>;
  days: Record<string, string>;
  hours: Record<string, string>;
}

function countPhrase(bag: Record<string, string>, count: number, locale: Locale): string {
  return pick(bag, pluralForm(locale, count)).replace("{count}", String(count));
}

export function TaskBoard({
  tasks,
  nowMs,
  /** Minutes of realistic study left today, from the capacity engine. */
  remainingStudyMinutes,
  /** Today's whole realistic study budget — the ring's denominator. */
  totalStudyMinutes,
  locale,
  t,
  priorityNames,
  typeNames,
}: {
  tasks: BoardTask[];
  nowMs: number;
  remainingStudyMinutes: number;
  totalStudyMinutes: number;
  locale: Locale;
  t: BoardStrings;
  priorityNames: Record<string, string>;
  typeNames: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const now = React.useMemo(() => new Date(nowMs), [nowMs]);

  /* THE SAME SERVER ACTION THE OLD LIST CALLED. The board is a different
     layout over the same data, not a second way of changing it: a redesign
     that reimplements the write is a redesign that can disagree with the
     screen it replaced. */
  function toggle(task: BoardTask) {
    startTransition(async () => {
      await updateTaskStatus(task.id, task.status === "COMPLETED" ? "NOT_STARTED" : "COMPLETED");
      router.refresh();
    });
  }
  const piles = React.useMemo(() => bucketTasks(tasks, now), [tasks, now]);

  /* Measured against the rows actually on screen, so the columns appear the
     moment his data starts to vary. */
  const open = [...piles.overdue, ...piles.thisWeek, ...piles.later];
  const showPriority = columnVaries(open, (x) => x.priority);
  const showFrom = columnVaries(open, (x) => x.fromDrop);
  /* Not one of his fifteen tasks carries an estimate, so the column would be
     "ما حدّدت وقتها" printed ten times down the page. The sidebar says it
     once, with the number and the action; the column comes back with the
     first estimate he sets. */
  const showTime = open.some((x) => typeof x.estimatedMinutes === "number" && x.estimatedMinutes > 0);

  const known = timeKnown(tasks);

  const hoursLeft = Math.floor(remainingStudyMinutes / 60);
  const fromDropCount = tasks.filter((x) => x.fromDrop).length;

  const PILES = [
    { key: "overdue" as const, title: t.overdue, empty: t.emptyOverdue, tone: "danger" as const },
    { key: "thisWeek" as const, title: t.thisWeek, empty: t.emptyThisWeek, tone: "warm" as const },
    { key: "later" as const, title: t.later, empty: t.emptyLater, tone: "quiet" as const },
    { key: "done" as const, title: t.done, empty: t.emptyDone, tone: "quiet" as const },
  ];

  /** "متأخرة بـ12 يوم" / "اليوم" / "بكرا" / "بعد 3 أيام". */
  function due(task: BoardTask): { text: string; late: boolean } {
    const days = daysUntil(task.deadline, now);
    if (days < 0) {
      return {
        text: t.lateBy.replace("{time}", countPhrase(t.days, Math.abs(days), locale)),
        late: true,
      };
    }
    if (days === 0) return { text: t.dueToday, late: true };
    if (days === 1) return { text: t.dueTomorrow, late: false };
    return { text: countPhrase(t.days, days, locale), late: false };
  }

  return (
    <div className="tb-layout">
      <div className="tb-main">
        {PILES.map((pile) => {
          const rows = piles[pile.key];
          return (
            <section key={pile.key} className="tb-pile">
              <h2 className="tb-pile-head">
                <span className={cn("tb-pile-title", pile.key === "overdue" && rows.length > 0 && "tb-late")}>
                  {pile.title}
                </span>
                {rows.length > 0 && (
                  <span className="t-figure tb-pile-count">{rows.length}</span>
                )}
              </h2>

              {rows.length === 0 ? (
                <p className="tb-empty">{pile.empty}</p>
              ) : (
                <ul className="tb-rows">
                  {rows.map((task) => {
                    const d = due(task);
                    return (
                      <li
                        key={task.id}
                        className={cn("tb-row", pile.key === "done" && "tb-row-done")}
                      >
                        <span className="tb-cell tb-task">
                          {/* 44px, because it is the control he presses most
                              on this screen and it is pressed with a thumb. */}
                          <button
                            type="button"
                            onClick={() => toggle(task)}
                            disabled={pending}
                            aria-label={task.status === "COMPLETED" ? t.markNotDone : t.markDone}
                            aria-pressed={task.status === "COMPLETED"}
                            className="tb-check"
                          >
                            {task.status === "COMPLETED" && <Check className="size-3.5" aria-hidden />}
                          </button>
                          {task.type === "PROJECT" ? (
                            <Link href={`/projects/${task.id}`} className="tb-link" dir="auto">
                              {task.title}
                            </Link>
                          ) : (
                            <span dir="auto">{task.title}</span>
                          )}
                        </span>

                        {/* THE CODE, NOT THE NAME, and `dir` on the element
                            that actually clips.
                        
                            "NURP (431) Nursing Leadership" in a 1.2fr cell
                            ellipsises — and in an RTL row it ellipsises at
                            its START, so the column read "…rsing Leadership"
                            on every line: the half that says WHICH course
                            was the half being thrown away. `shortCourseName`
                            exists for exactly this and returns "NURP 431".
                            `dir="auto"` has to sit on the element carrying
                            the overflow, not on a child inside it. */}
                        <span className="tb-cell tb-subject" dir="auto">
                          {task.subjectId && task.subjectName ? (
                            <Link href={`/subjects/${task.subjectId}`} className="tb-link">
                              {shortCourseName(task.subjectName)}
                            </Link>
                          ) : (
                            task.subjectName ? shortCourseName(task.subjectName) : ""
                          )}
                        </span>

                        {showFrom && (
                          <span className="tb-cell tb-from">
                            {task.fromDrop ? t.fromDrop : t.fromManual}
                          </span>
                        )}

                        <span className="tb-cell tb-due">
                          {pile.key === "done" ? (
                            <span className="tb-quiet">{typeNames[task.type] ?? task.type}</span>
                          ) : (
                            <Chip tone={d.late ? "danger" : "warm"}>{d.text}</Chip>
                          )}
                        </span>

                        {showPriority && (
                          <span className="tb-cell tb-priority">
                            {priorityNames[task.priority] ?? task.priority}
                          </span>
                        )}

                        {/* THE EMPTY ONE THAT STAYS. Every other blank column
                            is hidden; this one is the blank he can do
                            something about, so it says what is missing and
                            offers the action rather than printing a dash. */}
                        {showTime && (
                          <span className="tb-cell tb-time">
                            {typeof task.estimatedMinutes === "number" && task.estimatedMinutes > 0 ? (
                              <span className="t-figure">
                                {countPhrase(t.hours, Math.round(task.estimatedMinutes / 60), locale)}
                              </span>
                            ) : (
                              <span className="tb-quiet">{t.noEstimate}</span>
                            )}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <aside className="tb-side">
        {/* THE RING'S DENOMINATOR IS HIS OWN DAY, not a round number.
        
            It was eight hours, which made the arc read "54%" of nothing in
            particular — a percentage whose base the student cannot name is
            the naked figure this design system bans twice over. The base is
            now today's whole realistic study budget from the capacity
            engine, so the arc means "this much of today is still ahead of
            you". With no timetable recorded there is no budget and no ring:
            the hours stand on their own. */}
        <div className="tb-card tb-card-ring">
          {totalStudyMinutes > 0 ? (
            <ProgressRing
              value={Math.min(100, (remainingStudyMinutes / totalStudyMinutes) * 100)}
              size={88}
              label={t.todayLabel}
              sublabel={countPhrase(t.hours, hoursLeft, locale)}
            />
          ) : (
            <span className="t-figure tb-bare-hours">
              {countPhrase(t.hours, hoursLeft, locale)}
            </span>
          )}
          <p className="tb-kicker">{t.todayHeading}</p>
        </div>

        {/* THE RING CANNOT ACCOUNT FOR HIS WORK, AND SAYS SO.
        
            All fifteen tasks have no estimate, so any total this panel could
            print is zero — and "0 س of work" beside ten open tasks is the
            most confident lie the screen could tell. It names the number it
            cannot see and what to do about it. */}
        <div className="tb-card">
          <p className="tb-card-title">
            {known.unknownCount > 0 ? t.cannotPlanHeading : t.sourcesHeading}
          </p>
          <p className="tb-line">
            {known.unknownCount > 0
              ? t.cannotPlanBody.replace(
                  "{count}",
                  countPhrase(t.taskCount, known.unknownCount, locale)
                )
              : t.canPlanBody
                  .replace("{count}", countPhrase(t.taskCount, known.estimatedCount, locale))
                  .replace(
                    "{time}",
                    countPhrase(t.hours, Math.round(known.estimatedMinutes / 60), locale)
                  )}
          </p>
        </div>

        <div className="tb-card">
          <p className="tb-card-title">{t.sourcesHeading}</p>
          {/* WITH THEIR COUNTS. Three chips naming the three ways a task can
              arrive is a diagram; the same three with his numbers on them
              says that fifteen out of fifteen are his own typing, and that
              nothing has come out of a dropped file yet. */}
          <ul className="tb-sources">
            <li>
              <Chip>{`${t.sourceDrop} · ${fromDropCount}`}</Chip>
            </li>
            <li>
              <Chip>{`${t.sourceYou} · ${tasks.length - fromDropCount}`}</Chip>
            </li>
          </ul>
        </div>

        <div className="tb-card">
          <p className="tb-card-title">{t.dropHeading}</p>
          <p className="tb-line">{t.dropHint}</p>
          <DropZone className="mt-2" />
        </div>
      </aside>
    </div>
  );
}
