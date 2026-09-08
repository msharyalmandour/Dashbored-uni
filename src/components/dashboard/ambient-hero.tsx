import type { ReactNode } from "react";
import Image from "next/image";
import { getTimePeriod, type TimePeriod } from "@/lib/time-period";
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
 * Each photograph is chosen to match the hour it appears in, so the hero
 * tracks the day rather than showing one fixed picture: warm open field at
 * dawn, bright mist at midday, low green light in the evening, dark valley
 * at night. `alt` is empty on purpose — these are decoration behind text,
 * and announcing them would only add noise for a screen reader.
 */
const AMBIENT_PHOTO: Record<TimePeriod, string> = {
  morning: "/ambient/morning.jpg",
  day: "/ambient/day.jpg",
  evening: "/ambient/evening.jpg",
  night: "/ambient/night.jpg",
};

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
    <div className="relative isolate overflow-hidden rounded-2xl border border-border-subtle bg-surface-primary">
      <Image
        src={AMBIENT_PHOTO[period]}
        alt=""
        fill
        priority
        sizes="(max-width: 1024px) 100vw, 1200px"
        className="pointer-events-none object-cover opacity-90"
      />

      {/* Colour grade: ties the photograph to the app's palette so the hero
          reads as part of the product rather than a pasted-in picture. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-soft-light"
        style={{ background: `var(--ambient-${period})` }}
      />

      <div aria-hidden className="ambient-vignette pointer-events-none absolute inset-0" />

      {/* Legibility scrim. Kept as a vertical gradient rather than a
          horizontal one so it behaves identically in Arabic: a left-to-right
          scrim would put its dark end on the wrong side under RTL and leave
          the greeting sitting on the bright part of the photograph.
          Weighted towards the top and bottom edges, where the greeting and
          the stat tiles sit, and lightest through the middle so the
          photograph is actually visible rather than merely implied. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-surface-primary/80 via-surface-primary/35 to-surface-primary/70"
      />

      <div className="relative flex min-h-[220px] flex-col justify-between gap-6 p-6 sm:min-h-[280px] sm:p-10">
        {children}
      </div>
    </div>
  );
}
