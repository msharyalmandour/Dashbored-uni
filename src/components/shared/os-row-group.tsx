"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { useI18n } from "@/components/shared/i18n-provider";
import { format as formatDict } from "@/lib/i18n/dictionaries";

/**
 * The first few rows of a long section, and a way to ask for the rest.
 *
 * Grouping the review list by type fixed the comprehension problem and created
 * a navigation one. Sixty-nine items due is forty lectures, and the four
 * sections underneath — topics, flashcards, gaps, mistakes — sat below all
 * forty of them. A student with four mistakes to go over could see that they
 * had four mistakes only by scrolling past everything else first, which is the
 * same wall as before with a heading on it.
 *
 * Capping each section puts all five headings on one screen, so the shape of
 * the backlog is visible before any of it is. The cap is not a page: nothing is
 * dropped, and the count in the header is always the true total.
 */
export function OSRowGroup({
  children,
  limit = 6,
}: {
  children: React.ReactNode;
  /** How many rows to show before asking. */
  limit?: number;
}) {
  const { dict } = useI18n();
  const [expanded, setExpanded] = React.useState(false);

  const rows = React.Children.toArray(children);
  const hidden = rows.length - limit;

  if (hidden <= 0) return <>{rows}</>;

  return (
    <>
      {expanded ? rows : rows.slice(0, limit)}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex min-h-11 w-full items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-[oklch(100%_0_0_/_4%)] hover:text-foreground"
      >
        {expanded
          ? dict.common.showLess
          : formatDict(dict.common.showAllCount, { count: hidden })}
        <ChevronDown
          aria-hidden
          className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
    </>
  );
}
