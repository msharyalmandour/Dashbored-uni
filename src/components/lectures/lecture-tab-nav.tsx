"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The lecture's own navigation.
 *
 * The page used to be eight cards stacked down one column: understanding, then
 * notes, then resources, then slides, then videos, then gaps, then flashcards,
 * then questions. Everything a lecture knows, at the same weight, in one scroll
 * — which is the definition of a shallow page wearing a lot of cards.
 *
 * Tabs are the honest shape for it, because these are genuinely different
 * activities rather than sections of one document: reading the summary, writing
 * on the slides, and drilling the flashcards are three different sittings.
 *
 * Links rather than client state, so a tab is a URL: a student can leave the
 * slides open in one place and come back to it, and the back button means what
 * it looks like it means.
 */
export function LectureTabNav({
  lectureId,
  active,
  tabs,
}: {
  lectureId: string;
  active: string;
  tabs: { key: string; label: string; count?: number }[];
}) {
  return (
    <nav
      className="flex gap-1 overflow-x-auto rounded-xl bg-[oklch(11.5%_0.005_55_/_96%)] p-1 shadow-[inset_0_1px_0_oklch(100%_0_0_/_6%)]"
      aria-label="Lecture sections"
    >
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <Link
            key={t.key}
            href={`/lectures/${lectureId}${t.key === "overview" ? "" : `?tab=${t.key}`}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3.5 text-sm font-medium transition-colors",
              isActive
                ? "glossy"
                : "text-muted-foreground hover:bg-[oklch(100%_0_0_/_5%)] hover:text-foreground"
            )}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                  isActive ? "bg-[oklch(0%_0_0_/_18%)]" : "bg-[oklch(100%_0_0_/_8%)]"
                )}
              >
                {t.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
