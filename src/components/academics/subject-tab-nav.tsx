import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Three tabs, down from eight.
 *
 * The eight were overview, lectures, topics, flashcards, problems, gaps,
 * resources, analytics. Counted against this student's six real courses that
 * is forty-eight destinations with content in nine; `problems` and `analytics`
 * were empty in every course, `resources` had one row in one of them, and four
 * of the six courses were empty in all eight. See the course page's own
 * comment for the full count.
 *
 * What is left is what a student comes here to do, in the order they do it:
 * read the material, go over what did not land, review. Each of the three has
 * content for at least one of his courses today, which is the bar a tab has to
 * clear — and the pill row no longer scrolls sideways on a phone, which the
 * eight did.
 */
const TABS = [
  { key: "material", labelKey: "materialTab" },
  { key: "unclear", labelKey: "gapsTab" },
  { key: "review", labelKey: "flashcardsTab" },
] as const;

export function SubjectTabNav({
  subjectId,
  active,
  dict,
}: {
  subjectId: string;
  active: string;
  dict: Dictionary;
}) {
  return (
    <nav className="flex gap-6 border-b border-[color:var(--border)]">
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <Link
            key={tab.key}
            href={`/subjects/${subjectId}?tab=${tab.key}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              /* An underline on the active tab rather than a filled pill on a
                 grey track. The pill row was a second surface with its own
                 radius and fill, which is one more object to read on a page
                 that is now made of rules. */
              "-mb-px shrink-0 whitespace-nowrap border-b-2 pb-2.5 text-sm transition-colors",
              isActive
                ? "border-[color:var(--foreground)] font-semibold"
                : "border-transparent text-muted-foreground hover:text-[color:var(--foreground)]"
            )}
          >
            {dict.subject[tab.labelKey]}
          </Link>
        );
      })}
    </nav>
  );
}
