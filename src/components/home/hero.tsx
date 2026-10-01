import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, CalendarDays } from "lucide-react";
import { getTimePeriod } from "@/lib/time-period";
import { primaryCta, firstName, greetingKey } from "@/lib/home-metrics";
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
 * The academic-health ring used to sit at the right of this band and has moved
 * into the stat row, where the reference puts it — a figure about the whole
 * term belongs beside the other standing totals rather than beside a greeting.
 * Its right-hand side now holds the photograph and the quote instead.
 */
export function Hero({
  dict,
  now,
  userName,
  resumeHref,
  locale,
}: {
  dict: Dictionary;
  now: Date;
  userName: string;
  /** Where "continue" goes, or null when there is nothing mid-read. */
  resumeHref: string | null;
  locale: string;
}) {
  const t = dict.home.hero;
  const name = firstName(userName);
  const greeting = dict.home[greetingKey(getTimePeriod(now))];
  const cta = primaryCta(resumeHref);
  const rtl = locale === "ar";
  const Arrow = rtl ? ArrowLeft : ArrowRight;

  /* The ring moved out of here and into the stat row, which is where the
     reference puts it: a figure about the whole term belongs beside the other
     standing totals, not beside a greeting. See academic-snapshot.tsx. */

  return (
    /* A PHOTOGRAPH, not a coloured box.
    
       The reference opens on a real image of someone at a window in low sun,
       with the text set into its dark side. That is the whole difference in
       feel between this page and a dashboard: the band says "this is your
       evening" before a single number does.
    
       `evening.jpg` is the asset that already exists and already matches — the
       reference's light is a low warm sun, which is what this is.
    
       The image sits to the trailing side and the text to the leading side,
       with a gradient run across it so the headline never lands on a bright
       part of the photograph. Gradient stops rather than a flat scrim: a scrim
       dark enough for white text turns the picture to mud, and the point of
       the picture is that you can see it. */
    <section className="relative isolate overflow-hidden rounded-[var(--radius-xl)] border border-[color:var(--border)]">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-20">
        <Image
          src="/ambient/evening.jpg"
          alt=""
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 70vw"
          className="object-cover object-[60%_center]"
        />
      </div>
      {/* Leading-side wash. `to right` in LTR and flipped by the RTL variant,
          so the text side is the dark side in both directions rather than the
          headline landing on the sun in Arabic. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-[color:var(--background)] via-[color:var(--background)]/85 to-transparent rtl:bg-gradient-to-l"
      />

      <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-12">
        <div className="min-w-0">
          {/* Small, uppercase, tracked — the reference's eyebrow. It steps back
              so the name can be the headline, which is the reversal that makes
              this personal: the old hero led with a slogan and put the name in
              the small print. */}
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {greeting}
          </p>

          <h1 className="font-display mt-2 text-balance text-[clamp(2.5rem,6.5vw,4.5rem)] font-semibold leading-[0.98] tracking-tight">
            {/* The name is the one run on this page whose script the UI cannot
                know. `dir="auto"` lets the character decide, so a Latin name
                inside an Arabic line keeps its own order. */}
            <span dir="auto">{name || t.headline}</span>
            {/* The full stop, in the accent. One mark, and the only place the
                brand colour appears in the headline — the previous gradient
                across a whole phrase spent the colour where a single dot
                does the same work. */}
            {name && <span className="text-[color:var(--primary)]">.</span>}
          </h1>

          <p className="mt-3 max-w-[22ch] text-balance text-lg leading-snug text-muted-foreground">
            {t.headline} {t.headlineAccent}
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
                href="/time"
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-active)] bg-[color:var(--card)]/60 px-5 py-3 text-sm font-medium transition-colors hover:border-[color:var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
              >
                <CalendarDays className="size-4" />
                {t.viewWeek}
              </Link>
            )}
          </div>
        </div>

        {/* The quote, set off by a hairline rule exactly as the reference has
            it. It is the one thing on this page that is not a number, a door
            or a status, and the rule is what says so — without it the line
            reads as a caption belonging to the buttons above it.
        
            Hidden below lg: at phone width it would sit under the buttons as a
            fourth block of text before the student has reached a single fact
            about their day. */}
        <p className="hidden max-w-[22ch] border-s border-[color:var(--border-active)] ps-4 text-sm leading-relaxed text-muted-foreground lg:block">
          {t.quote}
        </p>
      </div>
    </section>
  );
}
