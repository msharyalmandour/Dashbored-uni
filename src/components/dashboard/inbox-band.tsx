import Link from "next/link";
import { Inbox, FileText, StickyNote, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/dictionaries";
import type { DashboardData } from "@/lib/dashboard";

/**
 * The dashboard's inbox band: what you dropped and have not yet dealt with.
 *
 * Sits between "today" and the longer-range signals because that is where it
 * belongs in a day — after knowing what is due, before thinking about the
 * semester. It shows the actual items rather than only a count, since a badge
 * is easy to ignore and a half-written thought you recognise is not.
 *
 * Every number and label here is a real row. When the inbox is empty the band
 * says so and offers the drop surface instead of hiding itself, so the way in
 * is always in the same place.
 */
export function InboxBand({ dict, inbox }: { dict: Dictionary; inbox: DashboardData["inbox"] }) {
  const t = dict.dashboard.inboxBand;

  return (
    <Card variant="quiet" className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/12 text-primary">
            <Inbox className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">{t.title}</p>
            <p className="text-xs text-muted-foreground">
              {inbox.waitingCount === 0 ? t.empty : format(t.waiting, { count: inbox.waitingCount })}
            </p>
          </div>
        </div>

        <Link
          href="/inbox"
          className="group inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {inbox.waitingCount === 0 ? t.dropSomething : t.openInbox}
          <ArrowUpRight className="size-3.5" />
        </Link>
      </div>

      {inbox.preview.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5 border-t border-border-subtle pt-3">
          {inbox.preview.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-xs text-muted-foreground">
              {item.kind === "FILE" ? (
                <FileText className="size-3.5 shrink-0" />
              ) : (
                <StickyNote className="size-3.5 shrink-0" />
              )}
              <span className="truncate">{item.label}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
