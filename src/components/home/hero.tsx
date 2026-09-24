import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays } from "lucide-react";
import { getTimePeriod } from "@/lib/time-period";
import { heroRing, primaryCta, firstName, greetingKey } from "@/lib/home-metrics";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Home's opening statement.
 *
 * What it is NOT is the marketing hero the references are: those sell a
 * product to someone who has not bought it. This one is read every morning by
 * someone who already has, so it gets about 340px and spends them on the two
 * things that change day to day — who you are and where you stopped — plus
 * one number that is worth a ring.
 *
 * The ring is academic health, under its own name. The reference shows
 * "67% Semester Progress"; this schema has no semester — no start date, no
 * credit load, no definition of done — so that percentage could only have been
 * invented. `heroRing` documents the substitution and verify-home-metrics.ts
 * asserts the words "semester progress" never reappear here.
 */
export function Hero({
  dict,
  now,
  userName,
  health,
  resumeHref,
  locale,
}: {
  dict: Dictionary;
  now: Date;
  userName: string;
  health: { score: number };
  /** Where "continue" goes, or null when there is nothing mid-read. */
  resumeHref: string | null;
  locale: string;
}) {
  const t = dict.home.hero;
  const name = firstName(userName);
  const greeting = dict.home[greetingKey(getTimePeriod(now))];
  const ring = heroRing(health);
  const cta = primaryCta(resumeHref);
  const rtl = locale === "ar";
  const Arrow = rtl ? ArrowLeft : ArrowRight;

  /* The arc, drawn rather than animated. 44px radius, 2πr = 276.46. */
  const R = 44;
  const C = 2 * Math.PI * R;

  return (
    <section className="relative isolate overflow-hidden rounded-[var(--radius-xl)]">
      {/* The section's own bloom, on top of the scene's trails. Deliberately
          off to one side: the middle of this box holds a headline. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ backgroundImage: "var(--brand-glow)" }}
      />

      <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-12">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            {greeting}
            {name ? (
              <>
                {dict.common.comma}{" "}
                {/* The name is the one run on this page whose script the UI
                    cannot know. `dir="auto"` lets the character decide, so a
                    Latin name inside an Arabic line keeps its own order. */}
                <span dir="auto" className="font-medium text-foreground">
                  {name}
                </span>
              </>
            ) : null}
          </p>

          <h1 className="font-display mt-3 text-balance text-[clamp(2rem,5.2vw,3.5rem)] font-semibold leading-[1.05] tracking-tight">
            {t.headline}
            <br />
            {/* The only gradient text in the product, and it is one phrase.
                A gradient on every heading is how a brand colour stops being
                a signal; here it marks the single line that names the idea. */}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "var(--brand-gradient)" }}
            >
              {t.headlineAccent}
            </span>
          </h1>

          <p className="mt-4 max-w-[46ch] text-balance leading-relaxed text-muted-foreground">
            {t.sub}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href={cta.href}
              className="group inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-[color:var(--primary-foreground)] shadow-[0_10px_30px_-12px_rgb(255_90_31_/_70%)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
              style={{ backgroundImage: "var(--brand-gradient)" }}
            >
              {cta.kind === "resume" ? t.resume : t.viewDay}
              <Arrow className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>

            {/* Only offered when it is not already the primary. Two buttons
                to the same place is a choice that is not one. */}
            {cta.kind === "resume" && (
              <Link
                href="/today"
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-5 py-3 text-sm font-medium transition-colors hover:border-[color:var(--border-active)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
              >
                <CalendarDays className="size-4" />
                {t.viewDay}
              </Link>
            )}
          </div>
        </div>

        {/* The ring. One figure, and it links to where the figure is explained. */}
        <Link
          href="/analytics"
          className="group flex items-center gap-5 justify-self-start rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--card)] p-5 transition-colors hover:border-[color:var(--border-active)] lg:justify-self-end"
        >
          <span className="relative grid size-[112px] shrink-0 place-items-center">
            <svg viewBox="0 0 112 112" className="size-full -rotate-90" aria-hidden>
              <circle cx="56" cy="56" r={R} fill="none" stroke="var(--border)" strokeWidth="8" />
              <circle
                cx="56"
                cy="56"
                r={R}
                fill="none"
                stroke="url(#uos-ring)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - ring.pct / 100)}
              />
              <defs>
                <linearGradient id="uos-ring" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ff8a00" />
                  <stop offset="45%" stopColor="#ff5a1f" />
                  <stop offset="100%" stopColor="#d92d00" />
                </linearGradient>
              </defs>
            </svg>
            <span className="absolute font-display text-2xl font-semibold tabular-nums">
              <span dir="ltr">{ring.pct}%</span>
            </span>
          </span>

          <span className="min-w-0">
            <span className="block text-sm font-semibold">{t.ringLabel}</span>
            <span className="mt-1 block max-w-[22ch] text-xs leading-relaxed text-muted-foreground">
              {t.ringHint}
            </span>
          </span>
        </Link>
      </div>
    </section>
  );
}
