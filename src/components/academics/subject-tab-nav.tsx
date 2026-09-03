import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "lectures", label: "Lectures" },
  { key: "topics", label: "Topics" },
  { key: "flashcards", label: "Flashcards" },
  { key: "problems", label: "Problems" },
  { key: "gaps", label: "Knowledge Gaps" },
  { key: "resources", label: "Resources" },
  { key: "analytics", label: "Analytics" },
];

export function SubjectTabNav({ subjectId, active }: { subjectId: string; active: string }) {
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
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
