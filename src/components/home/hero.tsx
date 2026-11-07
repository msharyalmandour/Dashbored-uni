import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays } from "lucide-react";
import { getTimePeriod } from "@/lib/time-period";
import { primaryCta, firstName, greetingKey } from "@/lib/home-metrics";
import { CinematicCard } from "@/components/ui/cinematic-card";
import { BrandMark } from "@/components/ui/brand-mark";
import { BRAND_LINE, BRAND_SUB } from "@/lib/brand";
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
 * The academic-health ring used to sit at the right of this band. It is gone
 * from the product entirely — a weighted composite over five axes is a number
 * about the student rather than about anything they can do — and this band's
 * right-hand side holds the photograph and the quote instead.
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

  /* THE SIX LAYERS, not a hand-rolled gradient over an <Image>.
  
     This band used to build its own: an absolutely positioned photograph, one
     linear gradient, and the app's old tokens. Every other surface in the
     product now goes through `CinematicCard` — image, dark ramp, ribbed
     glass, glow, noise, text — and a home page that assembles the same idea
     by hand is the one screen whose look drifts the first time the system
     changes. Rule 3 of the brief: nothing bypasses the components.
  
     THE PHOTOGRAPH HAS ARRIVED, AND IT IS TWO OF THEM. This band carried
     `/ambient/evening.jpg` — a green field under a grey sky, which against
     the warm palette read as a different product — then carried nothing at
     all while the real files were made. Both are here now.

     TWO, BECAUSE A WIDE PHOTOGRAPH IS NOT A PHONE PHOTOGRAPH. `hero.jpg` is
     2688×1520: a student at a window in low sun, the figure in the left
     third and the right two thirds dark, which is where the Arabic sits.
     Cropped to a 390px band that framing is gone — you get the dark third
     and no student. `corridor.jpg` is 1520×2688, shot tall for exactly that
     band. So the card takes both and the browser picks one before it
     requests anything; see `imageMobile` in cinematic-card.tsx.

     `center 30%` and `center 40%`: the framings the brief specifies, and on
     the wide file 30% is what keeps his face in the band rather than the
     ceiling above it.

     THE MARK AND THE LINE ARE ON IT NOW. The product is called «ارمِ كل شي
     هنا.» and the page a student opens every morning never said so. */
  return (
    <CinematicCard
      image="/images/cinematic/hero.jpg"
      imagePosition="center 30%"
      imageMobile="/images/cinematic/corridor.jpg"
      imageMobilePosition="center 40%"
      /* BOTH edges: the greeting and the button are on the leading one and
         the quote on the trailing one. See `.c-cine-dark-both`. */
      darkSide="both"
      ribbed
      priority
      sizes="100vw"
      className="hero-card"
    >
      <div className="hero-grid">
        <div className="min-w-0">
          <div className="hero-brand">
            <BrandMark size={34} variant="dark" />
            <span className="hero-brand-line">{BRAND_LINE}</span>
            <span className="hero-brand-sub">{BRAND_SUB}</span>
          </div>

          <p className="hero-eyebrow">{greeting}</p>

          <h1 className="t-kufi hero-name">
            {/* `dir="auto"` — the name is the one run on this page whose
                script the UI cannot know, so the character decides. */}
            <span dir="auto">{name || t.headline}</span>
            {name && <span style={{ color: "var(--o-500)" }}>.</span>}
          </h1>

          <p className="hero-sub">
            {t.headline} {t.headlineAccent}
          </p>

          <div className="hero-actions">
            {/* The one orange button on this screen. */}
            <Link href={cta.href} className="c-btn c-press hero-cta">
              {cta.kind === "resume" ? t.resume : t.viewDay}
              <Arrow className="size-4" aria-hidden />
            </Link>

            {/* Only when it is not already the primary. Two buttons to the
                same place is a choice that is not one. */}
            {cta.kind === "resume" && (
              <Link href="/time" className="c-btn-ghost c-press hero-cta">
                <CalendarDays className="size-4" aria-hidden />
                {t.viewWeek}
              </Link>
            )}
          </div>
        </div>

        {/* The quote, behind a hairline. Hidden below lg: at phone width it
            is a fourth block of text before the student reaches one fact
            about their day. */}
        <p className="hero-quote">{t.quote}</p>
      </div>
    </CinematicCard>
  );
}
