import type { ReactNode } from "react";
import { getTimePeriod } from "@/lib/time-period";
import type { Dictionary } from "@/lib/i18n/dictionaries";

function dayOfYear(now: Date) {
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
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
 * The small tagline in the opposite corner from the greeting is the one
 * purely editorial, non-data element in the hero — day-indexed from a
 * fixed set so it's stable per day rather than random per render.
 */
export function AmbientHero({ now, dict, children }: { now: Date; dict: Dictionary; children: ReactNode }) {
  const period = getTimePeriod(now);
  const tagline = dict.dashboard.taglines[dayOfYear(now) % dict.dashboard.taglines.length];

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
      <p className="pointer-events-none absolute end-6 top-6 hidden max-w-[220px] text-end text-xs italic text-muted-foreground/80 sm:block">
        &ldquo;{tagline}&rdquo;
      </p>
      <div className="relative flex min-h-[220px] flex-col justify-between gap-6 p-6 sm:min-h-[280px] sm:p-10">
        {children}
      </div>
    </div>
  );
}
