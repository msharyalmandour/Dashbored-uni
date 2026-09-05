import type { ReactNode } from "react";
import { getTimePeriod } from "@/lib/time-period";

/**
 * A cinematic, time-aware backdrop for the dashboard's hero. Composed as
 * stacked layers (atmosphere -> stars [night only] -> vignette -> legibility
 * scrim) rather than one flat gradient, so it reads as a place rather than
 * a color swatch. Everything is picked server-side from `now` — no
 * client-side flash, no hydration mismatch. Only two star points ever
 * animate (a slow opacity breathe); the atmosphere itself never moves.
 */
export function AmbientHero({ now, children }: { now: Date; children: ReactNode }) {
  const period = getTimePeriod(now);

  return (
    <div className="relative isolate overflow-hidden rounded-2xl border border-border-subtle bg-surface-primary">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `var(--ambient-${period})` }} />
      {period === "night" && (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70" style={{ backgroundImage: "var(--ambient-stars)" }} />
          <div
            aria-hidden
            className="ambient-star-twinkle pointer-events-none absolute size-[3px] rounded-full bg-white"
            style={{ top: "14%", left: "78%" }}
          />
          <div
            aria-hidden
            className="ambient-star-twinkle-slow pointer-events-none absolute size-[2px] rounded-full bg-white"
            style={{ top: "26%", left: "33%" }}
          />
        </>
      )}
      <div aria-hidden className="ambient-vignette pointer-events-none absolute inset-0" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-surface-primary/60 via-surface-primary/10 to-transparent"
      />
      <div className="relative min-h-[220px] p-6 sm:min-h-[260px] sm:p-10">{children}</div>
    </div>
  );
}
