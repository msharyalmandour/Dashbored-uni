"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/shared/i18n-provider";
import { undoDrop } from "@/app/actions/capture";
import { studentFacingError } from "@/lib/action-error";

/**
 * Takes back everything one drop wrote.
 *
 * This is the control that makes the rest of the feature safe to hand to
 * someone. An agent that writes a course, a week of classes and five tasks
 * without a way back means the first wrong reading of a blurry timetable is
 * permanent — and a student who has learned that a tool's mistakes are
 * permanent stops giving it anything that matters.
 *
 * It reports what was actually removed rather than claiming success, and names
 * anything it deliberately kept: a course the student has since added their own
 * work to stays, because losing a week of someone's notes to tidy up an agent's
 * mistake is the worse outcome by far.
 */
export function UndoDrop({
  captureId,
  onUndone,
  className,
}: {
  captureId: string;
  onUndone?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const { dict, format } = useI18n();
  const t = dict.inbox;
  const [busy, setBusy] = React.useState(false);

  async function run() {
    setBusy(true);
    try {
      const summary = await undoDrop(captureId);
      const count =
        summary.courses +
        summary.classes +
        summary.commitments +
        summary.tasks +
        summary.lectures +
        summary.gaps +
        summary.flashcards +
        summary.mistakes;

      toast.success(count > 0 ? format(t.agentUndone, { count }) : t.agentUndoNothing);

      // Named separately, because from the student's side this looks like undo
      // not having worked. Saying which course was kept, and why, is the
      // difference between a bug and a decision.
      for (const course of summary.coursesKept) {
        toast.info(format(t.agentUndoKeptCourse, { course }));
      }

      onUndone?.();
      router.refresh();
    } catch (err) {
      toast.error(studentFacingError(err, t.agentUndoFailed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="ghost" onClick={run} disabled={busy} className={className}>
      <Undo2 className="size-3.5" />
      {busy ? t.agentUndoing : t.agentUndo}
    </Button>
  );
}
