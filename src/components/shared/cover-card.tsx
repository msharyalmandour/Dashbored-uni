import * as React from "react";
import Link from "next/link";
import { ContentText } from "@/components/ui/content-text";
import { cn } from "@/lib/utils";

/**
 * A CARD, AND THE ONE CONDITION UNDER WHICH THIS APP DRAWS ONE.
 *
 * The `.tt` rules exist because cards were measured and removed: a border, a
 * fill, a radius and a shadow each say "this is a separate object, consider it
 * on its own", and a course page making that claim eight times makes it zero
 * times. That reasoning has not changed and this does not reverse it.
 *
 * What changed is that one kind of row now has a PICTURE in it. A thumbnail
 * needs an edge — it is a rectangle of someone else's artwork, usually white,
 * dropped onto a near-black page, and without a frame it reads as a hole
 * rather than as an object. That is a real reason for a card, and it is also
 * a rare one: it applies to decks and to nothing else on these screens.
 *
 * So the rule is not "cards are back". It is:
 *
 *     A CARD IS FOR A THING WITH A PICTURE. EVERYTHING ELSE IS STILL A RULE.
 *
 * which is border, fill, radius and shadow spent by role rather than stamped
 * on every block — the same principle that removed them, arriving at a
 * different answer for a different kind of content.
 */
export function CoverCard({
  href,
  cover,
  title,
  note,
  figure,
  accent,
  progress,
}: {
  href: string;
  /** The picture. Drawn by the caller, because only it knows the source. */
  cover: React.ReactNode;
  title: string;
  /** One line under the title — where they stopped, or how long it is. */
  note?: string;
  /** The number that matters, set in the corner of the picture. */
  figure?: React.ReactNode;
  /** The course's colour, if this card belongs to one. */
  accent?: string;
  /**
   * How far through, 0 to 1. Drawn as a rule across the foot of the picture
   * rather than as a bar with a track: a track is a second object and this is
   * a mark on the one already there.
   */
  progress?: number;
}) {
  const share = progress === undefined ? null : Math.max(0, Math.min(1, progress));

  return (
    <Link
      href={href}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card",
        "transition-colors hover:border-[color:var(--border-active)]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--primary)]"
      )}
    >
      {/* ONE FRAME, WHATEVER SHAPE THE DECK IS.
          A fixed 4:3 box with the page centred inside it, rather than a box
          that takes the page's own proportions. Decks are exported at whatever
          their author chose — 16:9, 4:3, an A4 handout in portrait — and three
          cards in a row each sized by their own file is a ragged row with
          titles that do not share a baseline. The page is letterboxed instead,
          and the bars are invisible because they are white on white: slides
          are white, which is also why the frame is white rather than the
          card's own near-black. A pale rectangle floating inside a dark one
          reads as a rendering failure. */}
      <div className="relative aspect-[4/3] overflow-hidden bg-white">
        {/* ABSOLUTE, and that is load-bearing rather than tidy.
            `aspect-ratio` sets the box's height from its width only while the
            content does not demand more; a portrait page in a flex row grew
            its own card taller than the landscape ones beside it, which is the
            exact raggedness the frame exists to prevent. Taken out of the flow,
            the page cannot argue with the frame. */}
        <div className="absolute inset-0 flex items-center justify-center">{cover}</div>

        {share !== null && (
          <div
            className="absolute inset-x-0 bottom-0 h-[3px] bg-black/15"
            role="presentation"
          >
            <div
              className="h-full transition-[width]"
              style={{
                width: `${share * 100}%`,
                backgroundColor: accent ?? "var(--primary)",
              }}
            />
          </div>
        )}

        {figure !== undefined && (
          <span
            className="tt-latin absolute end-1.5 top-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white"
            dir="ltr"
          >
            {figure}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-0.5 px-3 py-2.5">
        <p className="truncate text-[13px] font-semibold leading-snug">
          <ContentText>{title}</ContentText>
        </p>
        {note && <p className="truncate text-[11.5px] text-muted-foreground">{note}</p>}
      </div>

      {/* The course's colour, as a hairline down the start edge. Not a strip
          across the top: the top of this card is the picture, and a coloured
          band above a thumbnail reads as part of the thumbnail. */}
      {accent && (
        <span
          aria-hidden
          className="absolute inset-y-0 start-0 w-[2px]"
          style={{ backgroundColor: accent }}
        />
      )}
    </Link>
  );
}
