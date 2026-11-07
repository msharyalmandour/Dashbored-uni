import { cn } from "@/lib/utils";
import { pick, pluralForm } from "@/lib/i18n/plural";
import { Chip } from "@/components/ui/controls";
import { CinematicCard } from "@/components/ui/cinematic-card";
import { hoursUntil, type HospitalDay } from "@/lib/clinical-days";
import type { Locale } from "@/lib/i18n/config";

/**
 * «يومك الجاي بالمستشفى» — the one thing this page should answer first.
 *
 * NOT A SHIFT JOURNAL. The page under this already learned that lesson: the
 * five essay fields on `ClinicalTraining` held zero rows after twenty-four
 * days, because nobody writes a reflection at the end of an eight-hour
 * shift. This adds the half that costs nothing to read — when he is next in,
 * what he is in for, and how long he has to get ready — and leaves the
 * procedures list below exactly as it is.
 *
 * THE OSPE COUNTER FLOATS, and it is the only thing on the page that does.
 * It is the one number here that is both fixed and expensive to miss: 13
 * December, forty per cent. Everything else on this screen repeats weekly.
 *
 * A SERVER COMPONENT. Nothing here is pressed except a link.
 */

export interface HeroStrings {
  nextDay: string;
  inIt: string;
  today: string;
  tomorrow: string;
  inHours: string;
  prepareMe: string;
  noDays: string;
  upcoming: string;
  ospeIn: string;
  ospeToday: string;
  ospeWeight: string;
  noOspe: string;
  skillsEmpty: string;
  bagHeading: string;
  bagNotYet: string;
  days: Record<string, string>;
  hours: Record<string, string>;
}

export interface OspeInfo {
  title: string;
  daysLeft: number;
  /** Read off the title, or null when it does not say. */
  weight: number | null;
}

function countPhrase(bag: Record<string, string>, count: number, locale: Locale): string {
  return pick(bag, pluralForm(locale, count)).replace("{count}", String(count));
}

const clock = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;

/* ONE STRING, not three JSX children. "8:00", " – " and "16:50" as separate
   text nodes inside an RTL line are reordered into "16:50 – 8:00" — a
   hospital day that ends before it starts. Built as one string the run has a
   single direction and `.t-figure` isolates it. The week grid's `range()`
   does the same thing for the same reason. */
const span = (from: number, to: number) => `${clock(from)} – ${clock(to)}`;

export function HospitalHero({
  days,
  ospe,
  nowMs,
  locale,
  t,
  weekdayNames,
}: {
  days: HospitalDay[];
  ospe: OspeInfo | null;
  nowMs: number;
  locale: Locale;
  t: HeroStrings;
  weekdayNames: readonly string[];
}) {
  const now = new Date(nowMs);
  const next = days[0] ?? null;
  const rest = days.slice(1);

  /** Just the word: "اليوم" / "بكرا" / "الثلاثاء". */
  function dayWord(day: HospitalDay): string {
    if (day.inDays === 0) return t.today;
    if (day.inDays === 1) return t.tomorrow;
    return weekdayNames[day.weekday] ?? "";
  }

  const until = next ? hoursUntil(next, now) : null;

  return (
    <section className="hh-wrap">
      {/* `hospital.jpg`: a corridor at dusk with a nurse walking away, the
          figure dead centre and the lamps down the left wall. `center` is
          the brief's framing and it is the right one — the corridor's
          vanishing point is what makes the picture, and moving it off centre
          turns a hallway into a wall. Full width of the content column, so
          `sizes` says so rather than guessing a card width. */}
      <CinematicCard
        image="/images/cinematic/hospital.jpg"
        imagePosition="center"
        sizes="(max-width: 1024px) 100vw, 920px"
        priority
        darkSide="start"
        ribbed
        className="hh-card"
      >
        <div className="hh-inner">
          <p className="hh-kicker">{t.nextDay}</p>

          {next ? (
            <>
              {/* THE RANGE IS ONE RUN, NOT TWO NODES.
              
                  "بكرا" and " – 16:50" as separate children of an RTL line
                  are laid out as two blocks right to left, so the range came
                  out reading 16:50 – 8:00: the right glyphs, the wrong
                  direction, and a hospital day that appears to end before it
                  starts. Both times go in one `.t-figure` span, which
                  isolates them and lays them out as the single left-to-right
                  run they are. */}
              <h2 className="hh-when">
                {next.current ? (
                  t.inIt
                ) : (
                  <>
                    {dayWord(next)}{" "}
                    <span className="t-figure hh-span">{span(next.startMinute, next.endMinute)}</span>
                  </>
                )}
              </h2>

              <div className="hh-chips">
                {next.courses.map((c) => (
                  <Chip key={c}>{c}</Chip>
                ))}
                {until !== null && until > 0 && (
                  <Chip tone="warm">
                    {t.inHours.replace("{count}", countPhrase(t.hours, until, locale))}
                  </Chip>
                )}
              </div>

              {/* The one orange button on this screen. */}
              <a href="#procedures" className="c-btn c-press hh-cta">
                {t.prepareMe}
              </a>
            </>
          ) : (
            <p className="hh-empty">{t.noDays}</p>
          )}
        </div>
      </CinematicCard>

      {/* Floating, and nothing else on the page is. The one fixed, expensive
          date here; everything else repeats every week. */}
      {ospe && (
        <aside className={cn("hh-ospe c-floaty", ospe.daysLeft <= 7 && "hh-ospe-near")}>
          <p className="hh-ospe-line">
            {ospe.daysLeft <= 0
              ? t.ospeToday
              : t.ospeIn.replace("{count}", countPhrase(t.days, ospe.daysLeft, locale))}
          </p>
          {ospe.weight !== null && (
            <p className="hh-ospe-weight">{t.ospeWeight.replace("{n}", String(ospe.weight))}</p>
          )}
        </aside>
      )}

      {rest.length > 0 && (
        <div className="hh-upcoming">
          <h3 className="hh-h3">{t.upcoming}</h3>
          <ul className="hh-days">
            {rest.map((day) => (
              <li key={day.date.toISOString()} className="hh-day">
                <span className="hh-day-name">{weekdayNames[day.weekday]}</span>
                <span className="t-figure hh-day-time">{span(day.startMinute, day.endMinute)}</span>
                <span className="hh-day-courses">{day.courses.join(" · ")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* SAID OUT LOUD RATHER THAN DRAWN EMPTY. The bag is in the design and
          has no table behind it, and adding one to his live database without
          asking is not mine to do. */}
      <div className="hh-note">
        <p className="hh-note-title">{t.bagHeading}</p>
        <p className="hh-note-body">{t.bagNotYet}</p>
      </div>
    </section>
  );
}
