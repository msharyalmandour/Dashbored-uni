"use client";

import * as React from "react";
import Link from "next/link";
import { Moon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatMinutes } from "@/lib/time-intelligence";
import { format, type Dictionary } from "@/lib/i18n/dictionaries";
import type { EveningRead } from "@/lib/evening";

/**
 * The length of the offered evening session.
 *
 * It is a property of the offer, not a claim about the work: nobody is being
 * told the task takes a quarter of an hour. Fifteen minutes is short enough
 * that saying yes at 10pm is not a decision the student will regret, which is
 * the only reason to make the offer at all.
 */
const SHORT_SESSION_MINUTES = 15;

/** Where the dismissal is remembered — per browser, per day, nothing sent anywhere. */
const DISMISS_KEY = "evening-check-in-dismissed";

function readDismissed(dayKey: string): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === dayKey;
  } catch {
    // Private windows and blocked site data throw on access. Showing the
    // card is the harmless outcome, so failure never hides it.
    return false;
  }
}

/**
 * Nothing else in the tab writes this key, so there is no change to listen
 * for. The subscription exists only so React can read the value through the
 * one API that is safe across the server render, where storage does not exist.
 */
const NEVER_CHANGES = () => () => {};

/**
 * What the student did today, in their own numbers.
 *
 * Returns null when there is nothing to report, so the caller can choose a
 * sentence that does not pretend otherwise instead of printing "0 finished".
 */
function didLine(evening: EveningRead, dict: Dictionary): string | null {
  const parts: string[] = [];
  if (evening.tasksCompleted > 0) {
    parts.push(format(dict.today.eveningDidTasks, { count: evening.tasksCompleted }));
  }
  if (evening.focusMinutes > 0) {
    parts.push(
      format(dict.today.eveningDidFocus, {
        time: formatMinutes(evening.focusMinutes, {
          hours: dict.time.hours,
          minutes: dict.time.minutes,
        }),
      })
    );
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** The one honest sentence about today. */
function outcomeLine(evening: EveningRead, dict: Dictionary): string {
  const did = didLine(evening, dict) ?? "";
  switch (evening.outcome) {
    case "NOTHING_RECORDED":
      return dict.today.eveningNothingRecorded;
    case "SLIPPED":
      return format(dict.today.eveningSlipped, { count: evening.openDueToday });
    case "PARTIAL":
      return format(dict.today.eveningPartial, { did, count: evening.openDueToday });
    case "CLEARED":
      return format(dict.today.eveningCleared, { did });
  }
}

/**
 * What tomorrow is shaped like — the only thing in this card the student
 * could not have worked out by looking at their own day.
 */
function tomorrowLine(evening: EveningRead, dict: Dictionary): string {
  const { tomorrow, dueTomorrow } = evening;
  if (tomorrow.verdict === "UNKNOWN") return dict.today.eveningTomorrowUnknown;
  if (dueTomorrow === 0) return dict.today.eveningTomorrowClear;

  const params = {
    count: dueTomorrow,
    time: formatMinutes(tomorrow.availableMinutes, {
      hours: dict.time.hours,
      minutes: dict.time.minutes,
    }),
  };
  switch (tomorrow.verdict) {
    case "OVERLOADED":
      return format(dict.today.eveningTomorrowOverloaded, params);
    case "TIGHT":
      return format(dict.today.eveningTomorrowTight, params);
    case "FITS":
      return format(dict.today.eveningTomorrowFits, params);
  }
}

/**
 * The end of the daily loop.
 *
 * Deliberately not a review screen. There is no rating, no streak and no
 * mood question, because none of those would change anything the app does
 * tomorrow — collecting them would be theatre. What is here is what today
 * recorded, what tomorrow looks like, and two ways to leave: one more short
 * thing, or done. The second one is a real answer, not a snooze.
 */
export function EveningCheckIn({
  dict,
  evening,
  dayKey,
  shortThing,
}: {
  dict: Dictionary;
  evening: EveningRead;
  /** The current date, so a dismissal lasts the evening and not forever. */
  dayKey: string;
  shortThing?: { title: string; subjectId?: string; why?: string };
}) {
  // The server cannot see localStorage, so it renders the card and the client
  // hides it on the first commit if it was already closed today. Reading it
  // through useSyncExternalStore is what keeps that hydration-safe.
  const dismissed = React.useSyncExternalStore(
    NEVER_CHANGES,
    () => readDismissed(dayKey),
    () => false
  );
  const [closed, setClosed] = React.useState(false);

  if (dismissed) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, dayKey);
    } catch {
      // Nothing to recover from: the card still closes for this visit.
    }
    setClosed(true);
  }

  if (closed) {
    return (
      <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
        <Moon className="size-3.5" />
        {dict.today.eveningClosed}
      </p>
    );
  }

  const href = shortThing
    ? `/focus?${new URLSearchParams({
        do: shortThing.title,
        minutes: String(SHORT_SESSION_MINUTES),
        ...(shortThing.why ? { why: shortThing.why } : {}),
        ...(shortThing.subjectId ? { subject: shortThing.subjectId } : {}),
      }).toString()}`
    : null;

  return (
    <Card variant="quiet" className="flex flex-col gap-3 p-5">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Moon className="size-3.5" /> {dict.today.eveningTitle}
      </p>

      <p className="text-sm">{outcomeLine(evening, dict)}</p>
      <p className="text-sm text-muted-foreground">{tomorrowLine(evening, dict)}</p>

      <div className="flex flex-wrap items-center gap-2">
        {href && shortThing && (
          <Button asChild variant="secondary" size="sm">
            <Link href={href} title={shortThing.title}>
              {dict.today.eveningOneShortThing}
            </Link>
          </Button>
        )}
        {/* Equal weight, not a dismissal link in small grey text. Stopping is
            a legitimate answer to the evening, so it is offered as one. */}
        <Button variant="ghost" size="sm" onClick={dismiss}>
          {dict.today.eveningDismiss}
        </Button>
      </div>
    </Card>
  );
}
