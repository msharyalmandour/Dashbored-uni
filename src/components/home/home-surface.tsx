"use client";

import * as React from "react";
import { CalendarDays, GraduationCap, ListChecks, Sun } from "lucide-react";
import { useI18n } from "@/components/shared/i18n-provider";
import { DropAnything } from "@/components/inbox/drop-anything";
import { FloatingControl } from "@/components/home/floating-control";
import { getTimePeriod } from "@/lib/time-period";

/**
 * Home.
 *
 * What this replaced was a dashboard: six stacked sections, a statistics row,
 * a chart, a list of everything. It answered "how am I doing?" — a question a
 * student asks about once a month — and buried the one they ask every single
 * day, which is "what am I doing now?".
 *
 * So the page is that question, and one object that can answer it. The orb is
 * the only thing with weight; everything else is deliberately light enough to
 * ignore. The negative space is not restraint for its own sake — it is what
 * makes the orb read as the subject of the page rather than a widget on it,
 * and it is what lets the forest behind it stay visible, which is the point of
 * having a forest.
 *
 * The four controls are places, not features, and they sit at the bottom edge
 * where a thumb reaches on a phone and the eye goes last on a desktop. Counts
 * appear only when there is something to count.
 *
 * Nothing here is new machinery. `DropAnything` is the same component doing
 * the same work — uploads, the agent, the review pass, undo, the timetable
 * confirmation, long documents read in passes. It has been given a different
 * body, not a different job.
 */
export function HomeSurface({
  userName,
  dueToday,
  aiConfigured,
  canTranscribe,
  now,
}: {
  userName: string;
  /** How many things are actually due today. Zero is a real, good answer. */
  dueToday: number;
  aiConfigured: boolean;
  canTranscribe: boolean;
  now: Date;
}) {
  const { dict, format } = useI18n();
  const t = dict.home;

  // Picked from the server's `now` and passed down, so the greeting is stable
  // across hydration instead of flickering to a different time of day.
  const period = getTimePeriod(now);
  const greeting =
    period === "morning"
      ? t.greetingMorning
      : period === "evening"
        ? t.greetingEvening
        : period === "night"
          ? t.greetingNight
          : t.greetingDay;

  const dueLine =
    dueToday === 0 ? t.nothingDueToday : dueToday === 1 ? t.oneThingDue : format(t.thingsDue, { count: dueToday });

  return (
    <div className="relative flex min-h-[calc(100svh-9.5rem)] flex-col">
      {/* The greeting sits above the question rather than beside it: a name is
          an opening, not a label, and putting it on its own line is what keeps
          the question the largest thing on the page. */}
      <div className="orb-word flex flex-col items-center gap-1 text-center">
        <p className="on-env-quiet text-sm">
          {greeting}
          {userName ? `، ${userName}` : ""}
        </p>
      </div>

      {/* The centre of gravity. Everything above and below is edge. */}
      <div className="flex flex-1 flex-col items-center justify-center gap-5 py-4 sm:gap-7">
        <h1
          className="on-env orb-word max-w-[18ch] text-balance text-center text-[clamp(1.75rem,5vw,3rem)] font-semibold leading-[1.1] tracking-tight"
          style={{ animationDelay: "120ms" }}
        >
          {t.ask}
        </h1>

        {/* The whole drop surface — orb, field, controls, and every state it
            can be in. Unchanged in behaviour; this page only decides where it
            lives and how much room it gets. */}
        <div className="w-full max-w-2xl">
          <DropAnything aiConfigured={aiConfigured} canTranscribe={canTranscribe} bare />
        </div>

        <p
          className="on-env-quiet orb-word max-w-[38ch] text-balance text-center text-sm leading-relaxed"
          style={{ animationDelay: "260ms" }}
        >
          {t.dropLine}
          <span className="mt-1 block opacity-70">{dueLine}</span>
        </p>
      </div>

      {/* The way out. Four places, at the edge, small. */}
      <nav
        aria-label={dict.nav.sections.today}
        className="orb-word flex flex-wrap items-center justify-center gap-2 pb-4 sm:gap-3"
        style={{ animationDelay: "400ms" }}
      >
        <FloatingControl href="/today" icon={Sun} label={t.today} />
        <FloatingControl href="/calendar" icon={CalendarDays} label={t.schedule} />
        <FloatingControl href="/academics" icon={GraduationCap} label={t.courses} />
        <FloatingControl href="/tasks" icon={ListChecks} label={t.tasks} count={dueToday} />
      </nav>
    </div>
  );
}
