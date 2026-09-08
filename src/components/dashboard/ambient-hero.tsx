import type { ReactNode } from "react";
import { getTimePeriod } from "@/lib/time-period";
import type { Dictionary } from "@/lib/i18n/dictionaries";

function dayOfYear(now: Date) {
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
}

/**
 * Picks the day's editorial line. Day-indexed rather than random so it is
 * stable for a whole day instead of changing on every render, and exported
 * because the hero no longer renders it itself — see the note below.
 */
export function pickTagline(now: Date, dict: Dictionary) {
  return dict.dashboard.taglines[dayOfYear(now) % dict.dashboard.taglines.length];
}

/**
 * A cinematic, time-aware backdrop for the dashboard's hero. Composed as
 * stacked layers (atmosphere -> stars [night only] -> vignette -> legibility
 * scrim) rather than one flat gradient, so it reads as a place rather than
 * a color swatch. Everything is picked server-side from `now` — no
 * client-side flash, no hydration mismatch. Nothing here animates: the star
 * field is a static gradient layer, so the hero costs one paint and then
 * never asks the compositor for anything again.
 *
 * The day's tagline used to be absolutely positioned in the top corner.
 * That corner now holds the "today so far" panel, and two things competing
 * for one corner is not a layout — so the tagline moved into the text
 * column, where it reads as part of the greeting rather than as a
 * floating caption.
 */
export function AmbientHero({ now, children }: { now: Date; children: ReactNode }) {
  const period = getTimePeriod(now);

  return (
    <div className="relative isolate overflow-hidden rounded-2xl border border-border-subtle bg-surface-primary">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `var(--ambient-${period})` }} />
      {period === "night" && (
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70" style={{ backgroundImage: "var(--ambient-stars)" }} />
      )}
      <div aria-hidden className="ambient-vignette pointer-events-none absolute inset-0" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-surface-primary/60 via-surface-primary/10 to-transparent"
      />
      <div className="relative flex min-h-[220px] flex-col justify-between gap-6 p-6 sm:min-h-[280px] sm:p-10">
        {children}
      </div>
    </div>
  );
}
