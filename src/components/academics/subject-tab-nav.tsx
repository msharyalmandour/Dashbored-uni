import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const TABS = [
  { key: "overview", labelKey: "overviewTab" },
  { key: "lectures", labelKey: "lecturesTab" },
  { key: "topics", labelKey: "topicsTab" },
  { key: "flashcards", labelKey: "flashcardsTab" },
  { key: "problems", labelKey: "problemsTab" },
  { key: "gaps", labelKey: "gapsTab" },
  { key: "resources", labelKey: "resourcesTab" },
  { key: "analytics", labelKey: "analyticsTab" },
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
    <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1 no-scrollbar">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={`/subjects/${subjectId}?tab=${tab.key}`}
          className={cn(
            "shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            active === tab.key
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {dict.subject[tab.labelKey]}
        </Link>
      ))}
    </div>
  );
}
