import Image from "next/image";
import { MapPin, Repeat } from "lucide-react";
import { ContentText } from "@/components/ui/content-text";
import { nextUp, type DayEntry } from "@/lib/today-classes";
import { formatMinutes, formatMinuteOfDay } from "@/lib/time-intelligence";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * The next thing he has to be somewhere for.
 *
 * WHY IT CAN EXIST NOW. It could not before, and not for want of a component:
 * the day was read from `ScheduleEvent`, which held one week — the week the
 * timetable importer ran — so on the day this was built there was no "next"
 * to name, and there had not been one for a fortnight. The fix is in
 * src/lib/today-classes.ts, which reads the recurring shape of his week as
 * well. Building the card first would have produced something handsome that
 * rendered nothing on the only account that matters.
 *
 * WHAT IT SAYS, and the order is the decision it supports. A student looking
 * at this is deciding whether to leave. "Starts in 40 minutes" answers that;
 * "13:00" makes them do the subtraction first. So the countdown leads and the
 * clock time sits under it to check against — both, because the countdown
 * goes stale on a page left open and the clock time never does.
 *
 * THE PHOTOGRAPH IS NOT DECORATION — it is the one thing that separates a
 * clinical from a lecture at a glance, and on this timetable that is a real
 * distinction: a clinical means a hospital, a bag, and a 05:30 alarm for an
 * 08:00 start, while a lecture means a room on campus. `clinical.jpg` already
 * exists for exactly this and is used nowhere else on Home.
 *
 * WHEN THERE IS NOTHING LEFT it says so in a sentence rather than rendering
 * an empty card. "Nothing else scheduled today" at 17:00 on a Wednesday is a
 * fact worth stating — the student came to check — and it is the one state a
 * "next up" card is in for most of the evening.
 */
export function NextUp({
  classes,
  now,
  dict,
}: {
  classes: DayEntry[];
  now: Date;
  dict: Dictionary;
}) {
  const t = dict.today;
  const nowMinute = now.getHours() * 60 + now.getMinutes();
  const next = nextUp(classes, nowMinute);

  if (!next) {
    /* Quiet, and not a card. An empty state dressed as the thing it is empty
       of is how a screen starts feeling like it is pretending. */
    return (
      <section className="rounded-[var(--radius-lg)] border border-dashed border-[color:var(--border)] px-5 py-4">
        <p className="text-sm font-medium">{t.nextNothingLeft}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{t.nextNothingLeftHint}</p>
      </section>
    );
  }

  const isClinical = next.type === "CLINICAL";
  /* Units from the dictionary, never the default. `formatMinutes` takes them
     as an argument precisely because a Latin "m" dropped into an Arabic
     sentence is a bug this app has already had to fix once — and the first
     draft of this file reintroduced it by taking the default. */
  const units = { hours: dict.time.hours, minutes: dict.time.minutes };
  const away = next.startMinute - nowMinute;
  /* `formatMinutes` is the app's one duration format — "2h", "50m", "4h 50m".
     The timeline uses it for lengths and this uses it for a countdown, which
     is deliberate: two ways of writing the same quantity on one screen is how
     a student stops reading either. */
  const countdown =
    away <= 0 ? t.nextStartingNow : t.nextStartsIn.replace("{time}", formatMinutes(away, units));

  /* The app's own formatter, not `Intl`. An `ar-SA` DateTimeFormat renders
     Arabic-Indic digits — "٠٨:٠٠" — and put them on the same line as the
     Latin-digit duration beside it, two numeral systems in one sentence.
     `formatMinuteOfDay` is what every other commitment time in this app is
     drawn with, and it takes the minute directly, so there is no date to
     build and no zone to get wrong. */
  const clock = formatMinuteOfDay(next.startMinute);

  return (
    <section className="relative isolate overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--border)]">
      {isClinical && (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-20">
            <Image
              src="/ambient/clinical.jpg"
              alt=""
              fill
              sizes="(max-width: 1024px) 100vw, 60vw"
              className="object-cover object-[70%_center]"
            />
          </div>
          {/* Same treatment as the hero: a gradient run from the text side
              rather than a flat scrim, so the picture stays a picture. Flipped
              in Arabic so the words never land on the bright half. */}
          {/* The wash stops earlier than the hero's — `via-45%` rather than a
              midpoint — because this card is a third of the hero's height, so
              the same gradient over a much shorter box left the photograph a
              dark smudge. The hero's own note says the point of a picture is
              that you can see it; at this size that costs a shorter ramp. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-[color:var(--background)] from-30% via-[color:var(--background)]/80 via-45% to-transparent rtl:bg-gradient-to-l"
          />
        </>
      )}

      {/* A clinical gets more height, because it has a photograph to hold and
          because it is the heavier day: an 08:00 hospital start on this
          timetable is a 230-minute block. A lecture card stays compact. */}
      <div
        className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-5 sm:px-6 ${
          isClinical ? "py-6 sm:py-8" : "py-4 sm:py-5"
        }`}
      >
        {/* Alignment from the PAGE, direction from the CONTENT — the same rule
            as the Continue card. `ContentText` resolves a Latin course title
            to LTR and would take its alignment with it, leaving the lecture
            name floating in the middle of an Arabic card while the eyebrow
            above it sat flush right. Measured in the browser, not guessed. */}
        <div className="min-w-0 flex-1 rtl:text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t.nextUpEyebrow}
          </p>
          <ContentText as="p" className="mt-1 truncate text-[19px] font-semibold leading-snug">
            {next.title}
          </ContentText>

          {/* The facts under the name, only the ones that exist. A weekly
              shape has no room, so the chip is absent rather than empty. */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="tabular-nums">{clock}</span>
            {next.minutes !== null && next.minutes > 0 && (
              <span className="tabular-nums">{formatMinutes(next.minutes, units)}</span>
            )}
            {next.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden />
                <ContentText>{next.location}</ContentText>
              </span>
            )}
            {next.recurring && (
              <span className="inline-flex items-center gap-1">
                <Repeat className="size-3.5" aria-hidden />
                {t.nextRecurring}
              </span>
            )}
          </div>
        </div>

        {/* The countdown, set as the figure it is. Right-aligned in LTR and
            left in RTL via `text-end`, so it stays on the outside edge. */}
        <p className="shrink-0 text-end text-sm font-medium tabular-nums">{countdown}</p>
      </div>
    </section>
  );
}
