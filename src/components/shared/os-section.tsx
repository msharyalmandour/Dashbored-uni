import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A titled group of rows, on ground of its own.
 *
 * Two problems, one component.
 *
 * The first is readability. Every screen in this app floats over a photograph,
 * and a list row drawn as `border border-border` with no fill is a rectangle
 * with trees inside it. That is survivable for three rows and not for
 * sixty-nine: the review list rendered as a column of outlines with a forest
 * showing through every one of them. Anything with enough rows to scroll needs
 * to sit on something opaque — the same conclusion the week grid and the month
 * view each arrived at separately before this existed.
 *
 * The second is structure. `ReviewType` and `MistakeType` have five members
 * each, the database has always stored them, and both pages rendered one
 * undifferentiated list with the type repeated as a badge on every single row —
 * so the one piece of grouping the data already carried was spent restating
 * itself. A section header states it once and the rows get shorter.
 *
 * `count` is rendered separately from the title because it is a fact about the
 * list rather than part of its name, and because "Lectures 41" as a single
 * string does not survive translation into a language that counts differently.
 */
export function OSSection({
  title,
  count,
  icon: Icon,
  accent,
  meta,
  children,
  className,
}: {
  title: string;
  /** Shown beside the title. Omit when a count would be noise rather than news. */
  count?: number;
  icon?: React.ComponentType<{ className?: string }>;
  /** The section's own colour, for the icon and count. Defaults to the accent. */
  accent?: string;
  /** Anything that belongs on the header row — a filter, an action. */
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        // Opaque, and lifted by a one-pixel lit top edge rather than a border,
        // so a column of these reads as a stack of surfaces and not as a table.
        "overflow-hidden rounded-2xl bg-[oklch(11.5%_0.005_55_/_96%)] shadow-[inset_0_1px_0_oklch(100%_0_0_/_6%),0_10px_30px_-18px_oklch(0%_0_0_/_70%)]",
        className
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && (
            <span className="shrink-0" style={accent ? { color: accent } : undefined}>
              <Icon className={cn("size-4", !accent && "text-primary")} />
            </span>
          )}
          <h2 className="truncate font-display text-[15px] font-semibold">{title}</h2>
          {count !== undefined && (
            <span
              className="shrink-0 rounded-full bg-[oklch(100%_0_0_/_8%)] px-2 py-0.5 text-[11px] font-semibold tabular-nums"
              style={accent ? { color: accent } : undefined}
            >
              {count}
            </span>
          )}
        </div>
        {meta}
      </header>
      <div className="border-t border-[oklch(100%_0_0_/_6%)]">{children}</div>
    </section>
  );
}

/**
 * What a section says when it has nothing in it.
 *
 * Centralised because the three pages that needed one had written three, with
 * three different paddings and three different ways of saying the same thing,
 * and because an empty state is the screen a student sees on their first day —
 * the one place where "nothing here" has to read as a state rather than a bug.
 */
export function OSEmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      {Icon && <Icon className="size-6 text-muted-foreground" />}
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="max-w-sm text-xs text-muted-foreground">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/**
 * One row inside a section. Hairline-separated rather than boxed, because a
 * box inside a box is two borders saying one thing.
 */
export function OSRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-[oklch(100%_0_0_/_5%)] px-4 py-3 last:border-b-0 hover:bg-[oklch(100%_0_0_/_3.5%)]",
        className
      )}
    >
      {children}
    </div>
  );
}
