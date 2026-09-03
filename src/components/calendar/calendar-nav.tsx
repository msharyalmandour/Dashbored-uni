import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const VIEWS = ["month", "week", "day"] as const;

export function CalendarNav({
  view,
  label,
  prevHref,
  nextHref,
  todayHref,
}: {
  view: (typeof VIEWS)[number];
  label: string;
  prevHref: string;
  nextHref: string;
  todayHref: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Link href={prevHref}>
          <span className="flex size-8 items-center justify-center rounded-md border border-border hover:bg-muted">
            <ChevronLeft className="size-4" />
          </span>
        </Link>
        <Link href={nextHref}>
          <span className="flex size-8 items-center justify-center rounded-md border border-border hover:bg-muted">
            <ChevronRight className="size-4" />
          </span>
        </Link>
        <Link href={todayHref} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
          Today
        </Link>
        <h2 className="ml-2 font-display text-lg font-semibold">{label}</h2>
      </div>
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {VIEWS.map((v) => (
          <Link
            key={v}
            href={`/calendar?view=${v}`}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
              view === v ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {v}
          </Link>
        ))}
      </div>
    </div>
  );
}
