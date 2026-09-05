import type { ReactNode } from "react";
import { getTimePeriod } from "@/lib/time-period";

/**
 * A calm, time-aware backdrop for the dashboard's hero row. The gradient
 * itself is picked server-side from `now` (via --ambient-morning/day/
 * evening/night in globals.css) so there's no client-side flash or
 * hydration mismatch. It never animates — "time-aware" means it changes
 * across visits, not that it moves within one.
 */
export function AmbientHero({ now, children }: { now: Date; children: ReactNode }) {
  const period = getTimePeriod(now);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-surface-primary">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `var(--ambient-${period})` }} />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-surface-primary/55 via-surface-primary/10 to-transparent"
      />
      <div className="relative p-5 sm:p-8">{children}</div>
    </div>
  );
}
