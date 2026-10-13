import Link from "next/link";
import { Star } from "lucide-react";
import { ContentText } from "@/components/ui/content-text";
import type { Section } from "@/lib/lecture-sections";

/**
 * المحاضرة، توبيك توبيك.
 *
 * TWENTY-ONE SECTIONS IS THE POINT, AND THE PROBLEM. His own study file had
 * exactly this many for one lecture and he revised an exam from it — so the
 * length is the content, not bloat. But twenty-one open sections is a wall of
 * text at phone width, which is the thing he asked never to happen.
 *
 * So: every section is collapsed to its title, its slide range and its one-line
 * idea. That alone is a readable contents page of the lecture. Open one and
 * you get the exam warning and the points.
 *
 * `<details>`/`<summary>`, NOT a React toggle. Three reasons, in order of how
 * much they matter here:
 *   - It works before the JavaScript loads, which on a phone on hospital wifi
 *     is a real interval, and this screen is text.
 *   - Browser find-in-page opens a closed `<details>` to show a match. A React
 *     accordion hides the match and the student concludes the word is not in
 *     the lecture.
 *   - Keyboard and screen-reader behaviour comes for free and correct.
 *
 * EVERY POINT IS TWO HALVES, which is the whole design: `source` is the slide's
 * own English — what the exam quotes — and `note` is the Arabic explanation.
 * The English leads because that is the thing to recognise on the paper; the
 * Arabic sits under it in the muted colour because it is the scaffolding, not
 * the fact. A point with no `note` simply has no second line, which the rules
 * allow on purpose: filler would be worse.
 */

interface Labels {
  slidesLabel: string; /** "سلايد {slides}" */
  watch: string;
  openSlide: string; /** "افتح السلايد" */
  points: string;
}

export function TopicList({
  sections,
  lectureId,
  slideId,
  accent,
  labels,
}: {
  sections: (Section & { firstSlide?: number | null })[];
  lectureId: string;
  /** The one deck a slide range can open, or null when there isn't exactly one. */
  slideId: string | null;
  accent: string;
  labels: Labels;
}) {
  return (
    <ol className="flex flex-col gap-2.5">
      {sections.map((section, index) => (
        <li key={index}>
          <details className="glass group overflow-hidden pb-0 pt-0">
            <summary
              className="flex cursor-pointer list-none items-start gap-3 py-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
              /* `list-none` plus this kills the default triangle in every
                 engine; WebKit needs the pseudo-element form. */
            >
              <span
                aria-hidden
                className="mt-0.5 w-7 shrink-0 text-end text-[13px] font-semibold tabular-nums text-muted-foreground"
              >
                {index + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="t-body font-semibold">
                    <ContentText>{section.title}</ContentText>
                  </span>
                  {section.slides && (
                    <span className="t-meta tabular-nums text-muted-foreground" dir="auto">
                      {labels.slidesLabel.replace("{slides}", section.slides)}
                    </span>
                  )}
                  {/* The star is the lecturer's emphasis, not ours. Four of
                      twenty-one in the source — the rules refuse a breakdown
                      that marks much more than that. */}
                  {section.starred && (
                    <Star className="size-3.5 shrink-0" style={{ color: accent }} fill={accent} />
                  )}
                </span>
                <ContentText as="div" className="t-meta text-muted-foreground">
                  {section.idea}
                </ContentText>
              </span>
              <span
                aria-hidden
                className="mt-1 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              >
                ⌄
              </span>
            </summary>

            <div className="flex flex-col gap-3 pb-4 ps-10 pe-1">
              {/* انتبه, first inside the fold. It is the half a student cannot
                  get from the slides, so it sits above the points rather than
                  under them. */}
              {section.watch && (
                <div
                  className="t-meta rounded-[14px] border p-3"
                  style={{ borderColor: "rgb(255 255 255 / 14%)", background: "rgb(255 255 255 / 5%)" }}
                >
                  <span className="t-label block" style={{ color: accent }}>
                    {labels.watch}
                  </span>
                  <ContentText as="div" className="mt-1">
                    {section.watch}
                  </ContentText>
                </div>
              )}

              <ul className="flex flex-col gap-3">
                {section.points.map((point, p) => (
                  <li key={p} className="flex flex-col gap-0.5">
                    <ContentText as="div" className="t-label text-muted-foreground">
                      {point.heading}
                    </ContentText>
                    {/* The lecture's own sentence, leading.

                        `ContentText` IS the block here rather than sitting
                        inside one, and that is the whole fix for something
                        measured on this screen: an English sentence wrapped
                        over four lines was drawn RIGHT-aligned, with "done."
                        hanging alone on the right edge. `dir="auto"` on an
                        INLINE span sets that run's direction but not the line
                        alignment — the block it sits in still decides that,
                        and the block was RTL. As the block itself its own
                        `dir="auto"` governs, so English blocks align left and
                        Arabic ones right, each on its own reading edge. */}
                    <ContentText as="div" className="t-body">
                      {point.source}
                    </ContentText>
                    {point.note && (
                      <ContentText as="div" className="t-meta text-muted-foreground">
                        {point.note}
                      </ContentText>
                    )}
                  </li>
                ))}
              </ul>

              {/* The slides, openable. Only when exactly one deck owns the
                  lecture — with several there is no telling which document
                  "slide 9" means, so it stays the label it already is. */}
              {slideId && section.firstSlide && (
                <Link
                  href={`/lectures/${lectureId}/slides/${slideId}?page=${section.firstSlide}`}
                  className="t-meta self-start font-medium underline decoration-dotted underline-offset-4"
                  style={{ color: accent }}
                >
                  {labels.openSlide}
                </Link>
              )}
            </div>
          </details>
        </li>
      ))}
    </ol>
  );
}
