"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpenCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readWaitingFiles } from "@/app/actions/capture";
import { useI18n } from "@/components/shared/i18n-provider";
import { format } from "@/lib/i18n/dictionaries";

/**
 * One press instead of nineteen.
 *
 * The nightly sweep runs once a day and reads a few files at a time, so a
 * student who dropped an armful waits days for their own lectures to become
 * readable. Reading one file on demand already existed, per item. This asks for
 * all of them.
 *
 * Shown only when there is something unread, and it says how many — a button
 * offering to read nothing is a button that teaches you to ignore it.
 */
export function ReadWaitingFiles({ unreadCount }: { unreadCount: number }) {
  const router = useRouter();
  const { dict } = useI18n();
  const t = dict.inbox;
  const [reading, setReading] = React.useState(false);

  if (unreadCount < 1) return null;

  async function handleClick() {
    setReading(true);
    try {
      const summary = await readWaitingFiles();

      /* Three different outcomes, said differently. Collapsing them into "done"
         is how a student ends up believing a file was read when what actually
         happened is that it finished and held nothing. */
      if (summary.read > 0) {
        toast.success(format(t.readWaitingDone, { count: summary.read }));
      }
      if (summary.unreadable > 0) {
        toast.warning(format(t.readWaitingUnreadable, { count: summary.unreadable }));
      }
      if (summary.remaining > 0) {
        toast.info(format(t.readWaitingRemaining, { count: summary.remaining }));
      }
      if (summary.read === 0 && summary.unreadable === 0 && summary.remaining === 0) {
        toast.info(t.readWaitingNothing);
      }
      router.refresh();
    } catch {
      toast.error(t.readWaitingFailed);
    } finally {
      setReading(false);
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleClick} disabled={reading}>
      {reading ? <Loader2 className="size-4 animate-spin" /> : <BookOpenCheck className="size-4" />}
      {reading ? t.readWaitingBusy : format(t.readWaitingCta, { count: unreadCount })}
    </Button>
  );
}
