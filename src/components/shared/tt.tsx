import * as React from "react";
import Link from "next/link";
import { ContentText } from "@/components/ui/content-text";
import { cn } from "@/lib/utils";

/**
 * The timetable, as components.
 *
 * WHY THIS EXISTS. Measured on 2026-10-01: two files used the `.tt` rule
 * system and sixteen used the `Card` primitive, and a third language —
 * `OSSection`, an opaque rounded panel with two shadows — sat under the list
 * screens. So the app spoke three visual languages at once, and the one the
 * student picked ("the timetable": a rule not a card, numbers as furniture,
 * one marker) had reached the home page and stopped there.
 *
 * One language, and this is it. A section is a 2px rule with a quiet heading
 * over a column of rows separated by hairlines. There is no fill, no radius
 * and no shadow, so nothing has to be judged against anything: the hierarchy
 * is the weight of the rule at the top and the size of the figure on the left.
 *
 * WHY NOT A CARD. A card says "this is a separate object you should consider
 * on its own". On a course page with eight of them, that claim is made eight
 * times and means nothing — which is exactly how a page with four lectures on
 * it came to look busy. Border, fill, radius and shadow are spent by role
 * here, which in a list means not at all.
 *
 * `OSSection` is kept for the few screens that still sit over a photograph; it
 * hardcodes an oklch dark fill and only works there. Everything list-shaped
 * should use this.
 */

export function TtSection({
  /** What this list is. Short, in the student's own words. */
  title,
  /** A fact about the list, not part of its name — so it is rendered apart. */
  count,
  /** Anything that belongs on the heading row: an action, a filter, a total. */
  meta,
  children,
  className,
}: {
  title: string;
  count?: number;
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("tt", className)}>
      <div className="tt-head">
        <span className="flex min-w-0 items-baseline gap-2">
          <h2 className="truncate text-[15px] font-semibold">{title}</h2>
          {count !== undefined && (
            <span className="tt-meta tabular-nums">{count}</span>
          )}
        </span>
        {meta}
      </div>
      {children}
    </section>
  );
}

/**
 * One row.
 *
 * Three columns, always the same three: a figure, a label, a note. The figure
 * column is the discipline — ONE unit down any given column. Pages above
 * minutes reads as a fall, and nothing has fallen; this was caught by
 * rendering rather than by reasoning (see exam-band.tsx).
 *
 * `href` makes the whole row the target rather than a link inside it, because
 * a row whose only tappable part is six characters of title is a row that
 * misses on a phone.
 */
export function TtRow({
  figure,
  label,
  note,
  href,
  now,
  past,
  className,
  children,
}: {
  /** The one number this row is about. Latin and tabular; omit for none. */
  figure?: React.ReactNode;
  /** The row's words. Wrapped in ContentText so Arabic and Latin both set. */
  label?: React.ReactNode;
  /** The right-hand note: a date, a count, a state. Never a second figure. */
  note?: React.ReactNode;
  href?: string;
  /** The one marker on the page. Never more than one. */
  now?: boolean;
  /** Already happened. Dimmed, never removed. */
  past?: boolean;
  className?: string;
  /** For a row that is not the three-column shape — a form, an action. */
  children?: React.ReactNode;
}) {
  const classes = cn("tt-row", now && "tt-now", past && "tt-past", className);

  if (children) return <div className={classes}>{children}</div>;

  const body = (
    <>
      <span className="tt-n tt-latin">{figure}</span>
      <span className="tt-label">
        {typeof label === "string" ? <ContentText>{label}</ContentText> : label}
      </span>
      <span className="tt-meta tabular-nums">{note}</span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          classes,
          // The hover is a ground change on the row, not an underline on the
          // label: the row is the target, so the row is what responds.
          "transition-colors hover:bg-[color:var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--ring)]"
        )}
      >
        {body}
      </Link>
    );
  }

  return <div className={classes}>{body}</div>;
}

/**
 * Nothing here yet.
 *
 * One sentence and, where there is one, the single action that fills it.
 * Measured reason for the restraint: four of this student's six courses are
 * empty in every section, so the empty state is not an edge case on this
 * screen — it is the common case, and a drawn panel with an icon repeated down
 * an empty course is louder than the course with content in it.
 */
export function TtEmpty({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-3.5">
      <p className="text-sm text-muted-foreground">{children}</p>
      {action}
    </div>
  );
}
