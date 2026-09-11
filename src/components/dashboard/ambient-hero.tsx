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
 * A cinematic, time-aware backdrop for the dashboard's hero.
 *
 * Composed as stacked layers — photograph, colour grade, vignette, then a
 * legibility scrim — rather than one flat image, because the greeting and
 * the stat tiles sit on top of it and must stay readable at every hour. The
 * scrim is what makes that safe: the photograph never carries text contrast
 * on its own.
 *
 * The source images are small (736px wide), so they are deliberately used as
 * an out-of-focus backdrop rather than a sharp photograph — at hero width
 * they are upscaled, and the grade and scrim are what hide that. Replacing
 * them with larger files needs no code change, only better assets at the
 * same paths.
 *
 * Everything is picked server-side from `now`: no client-side flash, no
 * hydration mismatch. Nothing animates, so the hero costs one paint and then
 * never asks the compositor for anything again.
 *
 * The day's tagline used to be absolutely positioned in the top corner.
 * That corner now holds the "today so far" panel, and two things competing
 * for one corner is not a layout — so the tagline moved into the text
 * column, where it reads as part of the greeting.
 */
export function AmbientHero({ now, children }: { now: Date; children: ReactNode }) {
  const period = getTimePeriod(now);

  return (
    /**
     * The hero no longer carries a photograph of its own.
     *
     * It used to: a different picture for each part of the day, layered with
     * its own grade, vignette and scrim. That was right when the app was a
     * dark page and the hero was the only window in it. Now there is a forest
     * behind the entire product, and a second photograph inside the first one
     * put two environments on one screen arguing about where the light comes
     * from — the page read as a collage rather than a place.
     *
     * So the hero became what it should be now: a panel. The environment shows
     * through it, the material is the same one every other surface uses, and
     * the time of day is still felt — it is just felt through the one
     * environment rather than announced by a second.
     */
    <div className="panel relative isolate overflow-hidden">
      {/* The day's colour, kept — it is the part that made the hero feel like
          morning or evening, and it costs one gradient rather than a second
          photograph. Soft-light so it tints the forest showing through instead
          of painting over it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70 mix-blend-soft-light"
        style={{ background: `var(--ambient-${period})` }}
      />

      <div className="relative flex min-h-[220px] flex-col justify-between gap-6 p-6 sm:min-h-[280px] sm:p-10">
        {children}
      </div>
    </div>
  );
}
