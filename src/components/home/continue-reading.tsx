import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ContentText } from "@/components/ui/content-text";
import { resumeTarget, type ResumeTarget } from "@/lib/resume";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * The one deck worth going back into, as a card rather than a list row.
 *
 * WHAT THIS REPLACED, and why the old one was wrong even though it was tidy: a
 * generic icon square, three lines of stacked text at descending sizes, and a
 * hairline bar. Nothing in it was specific to a slide deck — swap the icon and
 * the same component is a row in a settings list. It also led with a label
 * ("Continue where you left off") and buried the one thing the student is
 * looking for, which is WHICH lecture.
 *
 * So the composition follows the reference's card language rather than the row
 * language: two cells divided by a rule, the way the academic snapshot's bar
 * divides its figures, with the lecture title as the headline and the course as
 * its eyebrow.
 *
 * THE LEADING CELL IS THE POINT. "20 / 46" set large in tabular numerals is the
 * fact the student actually navigates by — where they are in a physical stack
 * of slides — and it is a number this app has honestly and a quiz app does not.
 * It earns the position an icon was occupying, and unlike the icon it changes
 * as they read.
 *
 * WHAT IS DELIBERATELY ABSENT. No percentage: 20 of 46 is 43%, and the
 * fraction is both more useful (it is the number on the slide in front of
 * them) and more checkable. No "start over" and no progress ring — those are
 * decisions about a deck, and Home is not where decisions about a deck get
 * made; it is where you get back into one. Studio's version of this card keeps
 * them.
 *
 * The query lives in src/lib/resume.ts, shared with the hero's primary button
 * and request-cached, so the button and this card can never point at different
 * decks.
 *
 * A NOTE ON WHY THE NUMBERS ARE TRUSTWORTHY NOW. Until 2026-09-30 they were
 * not: `LectureSlide.pageCount` defaulted to 1 and was corrected only by the
 * viewer in the student's browser, so a 51-page deck read that it had one page,
 * this card could never offer it back — there was nowhere to continue TO — and
 * page one counted as finishing it. The count is now written where the file is
 * parsed. See src/lib/processors/index.ts.
 */
export async function ContinueReading({ userId, dict }: { userId: string; dict: Dictionary }) {
  const next = await resumeTarget(userId);
  if (!next) return null;
  return <ContinueReadingCard target={next} dict={dict} />;
}

/**
 * The card itself, given the target rather than finding it.
 *
 * Split from the fetch so the composition can be rendered without a database.
 * That is not a convenience: the direct Postgres port is not reachable from
 * the environment this was built in, so a card that could only draw itself
 * after a query was a card whose layout could not be looked at — and "the
 * visual arrangement is the most important thing" is the brief. Now it can be
 * handed the real numbers and photographed.
 *
 * It also makes the two halves separately wrong-able, which is the point of
 * splitting anything: `resumeTarget` decides WHICH deck, this decides how a
 * deck reads.
 */
export function ContinueReadingCard({
  target: next,
  dict,
}: {
  target: ResumeTarget;
  dict: Dictionary;
}) {
  const S = dict.studio;
  const remaining = Math.max(0, next.pageCount - next.lastPage);
  const left =
    remaining === 1
      ? S.onePageLeft
      : S.pagesLeft.replace("{count}", String(remaining));

  return (
    <Link
      href={next.href}
      className="group/cont block rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--card)] transition-colors hover:border-[color:var(--border-active)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
    >
      {/* `items-stretch` so the dividing rule runs the full height of the card
          rather than the height of the text — the rule is the structure, and a
          short rule reads as a stray line. */}
      {/* `min-w-0` so the row may shrink below its content: without it the
          title cell keeps its intrinsic width, the card outgrows its column
          and the page scrolls sideways on a phone. Measured at 390px. */}
      <div className="flex min-w-0 items-stretch">
        {/* The position. `tabular-nums` because this number changes on every
            page turn and digits of different widths would make the card twitch
            as it counts up. */}
        <div className="flex shrink-0 flex-col justify-center px-5 py-4 sm:px-6">
          {/* One word. This was "Continue where you left off", and driving the
              card at 360px showed what that costs: the cell is `shrink-0`, so
              a long label sets its width, and at phone width it took 525px of
              a 360px card and crushed the lecture title to single clipped
              characters. The card was fine at desk width and unusable on the
              device it is mostly read on — which is exactly the class of
              mistake a screenshot catches and a code review does not. */}
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {S.pageLabel}
          </p>
          <p className="mt-1 flex items-baseline gap-1 tabular-nums">
            <span className="text-[28px] font-semibold leading-none">{next.lastPage}</span>
            <span className="text-sm leading-none text-muted-foreground">/ {next.pageCount}</span>
          </p>
        </div>

        {/* `border-s`, not `border-l`: the divider has to move to the other
            side in Arabic, and this page is read in Arabic. */}
        {/* Alignment from the PAGE, direction from the CONTENT.
        
            `ContentText` sets `dir="auto"`, which is right for ordering — this
            student's courses are Latin and his lecture titles are often Arabic,
            and each has to run its own way. But `dir` also supplies the default
            alignment, so on an Arabic page the Latin course name would sit
            flush LEFT under a title flush right: three lines of one card
            against two different edges.
        
            `text-align: start` does not fix it — it resolves against the
            element's own resolved direction, which is exactly the thing that
            differs. `rtl:` compiles to an ancestor selector, so this takes the
            page's direction and every line in the cell inherits it. Verified
            in the browser: computed `text-align` is `right` on the cell and on
            the Latin course name inside it. */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 border-s border-[color:var(--border)] px-5 py-4 rtl:text-right sm:px-6">
          <ContentText as="p" className="truncate text-xs text-muted-foreground">
            {next.subjectName}
          </ContentText>
          {/* The headline. A lecture title is the student's own words — or his
              lecturer's — so it is set as content text and allowed to be long;
              `truncate` rather than a clamp because a second line here would
              push the card's height around as decks change. */}
          <ContentText as="p" className="truncate text-[17px] font-semibold leading-snug">
            {next.lectureTitle}
          </ContentText>
          <p className="truncate text-xs text-muted-foreground">{left}</p>
        </div>

        <div className="flex shrink-0 items-center pe-5 sm:pe-6">
          <ArrowRight className="size-5 text-muted-foreground transition-transform group-hover/cont:translate-x-0.5 rtl:rotate-180 rtl:group-hover/cont:-translate-x-0.5" />
        </div>
      </div>

      {/* The bar closes the card rather than floating inside it: it measures
          the whole thing above it, so it spans the whole thing above it.

          It reads from where they ARE, not from how far they have ever got.
          Both numbers are true and they are different; a full bar beside "you
          stopped at page 2 of 46" reads as a bug. */}
      <div
        className="h-[3px] w-full overflow-hidden rounded-b-[var(--radius-lg)] bg-[color:var(--surface-elevated)]"
        role="presentation"
      >
        <div
          className="h-full transition-[width] duration-500"
          style={{
            width: `${Math.round((next.lastPage / Math.max(1, next.pageCount)) * 100)}%`,
            backgroundImage: "var(--brand-gradient)",
          }}
        />
      </div>
    </Link>
  );
}
