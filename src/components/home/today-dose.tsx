import { TtSection, TtRow, TtEmpty } from "@/components/shared/tt";
import { ContentText } from "@/components/ui/content-text";
import { format, type Dictionary } from "@/lib/i18n/dictionaries";
import { pluralForm, pick } from "@/lib/i18n/plural";
import type { Locale } from "@/lib/i18n/config";
import type { TodayDose } from "@/lib/today-dose";

/**
 * جرعة اليوم — what to study today, and why.
 *
 * The product's one promise is that exams never pile up, and until now the
 * home page could only warn: the exam band says "a midterm in eleven days with
 * ninety-two unread pages behind it", which is true, alarming, and not an
 * instruction. This is the instruction.
 *
 * WHAT IT DELIBERATELY DOES NOT DO:
 *
 *   It does not draw a progress ring, a streak or a percentage. The figure a
 *   student needs at seven in the morning is how many lectures tonight, and
 *   everything else on this band is there to make that number trustworthy.
 *
 *   It does not hide a plan that does not fit. When four exams collide the
 *   dose can exceed what an evening holds; saying "5 lectures" and quietly
 *   meaning "you are not going to do this" would be the app lying politely.
 *   The over-full day is stated, with the advice to start at the top.
 *
 *   It renders NOTHING when there is nothing — not an empty state with an
 *   icon. An encouraging panel saying "all clear" every morning is how a
 *   student learns to scroll past the band that will one day say something.
 */
export function TodayDoseBand({
  dose,
  dict,
  locale,
}: {
  dose: TodayDose;
  dict: Dictionary;
  locale: Locale;
}) {
  const D = dict.home.dose;
  const nothing = dose.lectures.length === 0 && dose.piling.length === 0;
  if (nothing) return null;

  /* Today and tomorrow get their own words — nobody says "in 0 days" — and
     everything past that goes through the count rule, because Arabic has five
     forms and "باقي 4 يوم" is the kind of mistake that makes an app read like
     a machine translation of itself. See src/lib/i18n/plural.ts. */
  const why =
    dose.reason === null
      ? null
      : dose.reason.daysLeft <= 0
        ? format(D.becauseToday, { title: dose.reason.title })
        : dose.reason.daysLeft === 1
          ? format(D.becauseTomorrow, { title: dose.reason.title })
          : format(pick(D.because, pluralForm(locale, dose.reason.daysLeft)), {
              title: dose.reason.title,
              days: dose.reason.daysLeft,
            });

  return (
    <div className="flex flex-col gap-6">
      <TtSection
        title={D.heading}
        count={dose.lectures.length > 0 ? dose.lectures.length : undefined}
        meta={why ? <span className="t-meta text-muted-foreground">{why}</span> : undefined}
      >
        {dose.lectures.length === 0 ? (
          <TtEmpty>{D.none}</TtEmpty>
        ) : (
          <>
            {dose.lectures.map((lecture, i) => (
              <TtRow
                key={lecture.id}
                href={lecture.href}
                figure={i + 1}
                label={
                  <span className="flex min-w-0 items-center gap-2">
                    {/* The course's colour, same dot in the same place as on
                        the course page — rule 8: one colour per course, used
                        the same way everywhere. */}
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: lecture.accent }}
                    />
                    <ContentText className="truncate">{lecture.title}</ContentText>
                  </span>
                }
                note={lecture.courseName}
              />
            ))}
            {(dose.light || dose.overloaded) && (
              <p className="t-meta py-3 text-muted-foreground">
                {dose.overloaded ? D.tooMuch : D.light}
              </p>
            )}
          </>
        )}
      </TtSection>

      {/* The pile, and only the real one. A lecture inside an exam's window is
          already in the dose above; repeating it here as a failure would
          accuse the student of being behind on the exact thing the app has
          just told them to do this evening. */}
      {dose.piling.length > 0 && (
        <TtSection title={D.piling} count={dose.piling.length}>
          {dose.piling.map((lecture) => (
            <TtRow
              key={lecture.id}
              href={lecture.href}
              label={
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: lecture.accent }}
                  />
                  <ContentText className="truncate">{lecture.title}</ContentText>
                </span>
              }
              note={lecture.courseName}
            />
          ))}
          <p className="t-meta py-3 text-muted-foreground">{D.pilingNote}</p>
        </TtSection>
      )}
    </div>
  );
}
