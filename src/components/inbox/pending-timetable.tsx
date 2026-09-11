"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/shared/i18n-provider";
import { confirmPendingWrites, discardPendingWrites } from "@/app/actions/capture";
import type { PendingTimetable } from "@/lib/ai/agent/pending";
import { studentFacingError } from "@/lib/action-error";

/**
 * The week the agent read, before any of it is in the calendar.
 *
 * This is the one place the student is shown what is about to happen rather
 * than what already did, and it is deliberately the only one. A timetable
 * import is the single call that turns one photograph into dozens of rows, that
 * replaces whatever the last import claimed, and whose mistakes propagate into
 * every judgement this app makes about how much free time they have. Everything
 * else the agent writes is one or two rows, visible immediately, undoable on
 * their own — gating those too would rebuild the filing work the whole feature
 * exists to remove.
 *
 * The classes themselves are shown, not a count. "19 classes across 6 courses"
 * cannot be checked; "Sunday 08:00 Anatomy" can be checked in a second by the
 * one person who knows.
 */
export function PendingTimetableCard({
  captureId,
  pending,
  onSettled,
}: {
  captureId: string;
  pending: PendingTimetable;
  onSettled?: () => void;
}) {
  const router = useRouter();
  const { dict, format } = useI18n();
  const t = dict.inbox;
  const [busy, setBusy] = React.useState(false);

  const days = t.weekdayNames.split(",");

  // Grouped by day and ordered by time, because that is the shape the student
  // checks it against — their actual week, not the order the model happened to
  // read the rows off the photograph.
  const byDay = React.useMemo(() => {
    const groups = new Map<number, PendingTimetable["entries"]>();
    for (const entry of pending.entries) {
      const list = groups.get(entry.weekday) ?? [];
      list.push(entry);
      groups.set(entry.weekday, list);
    }
    return [...groups.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([weekday, entries]) => ({
        weekday,
        entries: [...entries].sort((a, b) => a.startTime.localeCompare(b.startTime)),
      }));
  }, [pending.entries]);

  async function confirm() {
    setBusy(true);
    try {
      await confirmPendingWrites(captureId);
      toast.success(format(t.pendingAdded, { count: pending.entries.length }));
      onSettled?.();
      router.refresh();
    } catch (err) {
      toast.error(studentFacingError(err, t.pendingFailed));
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    try {
      await discardPendingWrites(captureId);
      toast.info(t.pendingRejected);
      onSettled?.();
      router.refresh();
    } catch (err) {
      toast.error(studentFacingError(err, t.pendingFailed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="orb-emerge mt-4 flex w-full flex-col gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
      <p className="flex items-start gap-2.5 text-sm font-medium">
        <CalendarCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        <span>
          {t.pendingHeading}
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{t.pendingBody}</span>
        </span>
      </p>

      <div className="flex flex-col gap-2">
        {byDay.map(({ weekday, entries }) => (
          <div key={weekday} className="flex flex-col gap-1">
            <p className="text-xs font-semibold text-muted-foreground">{days[weekday] ?? weekday}</p>
            <ul className="flex flex-col gap-0.5">
              {entries.map((entry, index) => (
                <li key={`${weekday}-${index}`} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                  <span className="font-mono text-foreground/70">
                    {entry.startTime}–{entry.endTime}
                  </span>
                  <span className="font-medium">{entry.courseName}</span>
                  {entry.location && <span className="text-muted-foreground">{entry.location}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={confirm} disabled={busy}>
          <Check className="size-3.5" />
          {busy ? t.pendingSaving : t.pendingConfirm}
        </Button>
        <Button size="sm" variant="ghost" onClick={reject} disabled={busy}>
          <X className="size-3.5" />
          {t.pendingReject}
        </Button>
      </div>
    </div>
  );
}
