"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ContentText } from "@/components/ui/content-text";
import { TtSection } from "@/components/shared/tt";
import { updateGapStatus } from "@/app/actions/knowledge-gap";
import { useI18n } from "@/components/shared/i18n-provider";
import type { GapListItem } from "@/lib/knowledge-gaps";

/**
 * "Still true?" — the one thing the gaps board never did.
 *
 * Measured on the real account: twelve knowledge gaps, created 2026-09-11,
 * every one still NOT_UNDERSTOOD eighteen days later. Zero resolved, ever.
 *
 * The board shows them in five columns and waits. Waiting is what produced
 * twelve out of twelve: a gap eighteen days old is not a gap any more, it is a
 * deferred decision, and the student is the only one who knows which way it
 * goes. They either learned it somewhere and never said so, or they have been
 * avoiding it — and those need opposite help, which is exactly why the system
 * must ask rather than decide.
 *
 * TWO BUTTONS, AND NEITHER OF THEM IS "DISMISS".
 *
 * "I've got it now" writes MASTERED, because the student said so. "Still don't
 * get it" writes LEARNING — which is not a no-op: it moves the gap off the
 * untouched pile, bumps updatedAt, and so resets the fourteen-day clock in
 * follow-through.ts. Saying "still stuck" is an answer, and it is recorded as
 * one rather than leaving the question to be asked again tomorrow.
 *
 * What is deliberately absent is any path by which the system closes a gap
 * itself. A gap marked mastered by a timer is a false claim about what the
 * student knows, and this record is meant to be the one thing in their life
 * that does not lie to them about that.
 */
export function StaleGaps({ gaps, now }: { gaps: GapListItem[]; now: string }) {
  const { dict } = useI18n();
  const t = dict.knowledgeGaps.stale;
  const [pending, setPending] = React.useState<string | null>(null);
  /* Answered gaps leave the list immediately rather than waiting for the
     revalidate. The question has been answered; leaving it on screen for
     another second reads as the answer not having registered. */
  const [answered, setAnswered] = React.useState<Set<string>>(new Set());

  const visible = gaps.filter((g) => !answered.has(g.id));
  if (visible.length === 0) return null;

  async function answer(id: string, status: "MASTERED" | "LEARNING") {
    setPending(id);
    try {
      await updateGapStatus(id, status);
      setAnswered((prev) => new Set(prev).add(id));
      toast.success(status === "MASTERED" ? t.closed : t.kept);
    } catch {
      toast.error(dict.common.somethingWentWrong);
    } finally {
      setPending(null);
    }
  }

  const daysSince = (iso: string) =>
    Math.max(0, Math.floor((new Date(now).getTime() - new Date(iso).getTime()) / 86_400_000));

  return (
    /* Was a bordered card with its own fill and an icon in the heading. It is
       a list of questions, so it is a section of rows like every other list —
       and it keeps the days figure, which is the whole reason it exists. */
    <TtSection title={t.heading} meta={<span className="tt-meta">{t.hint}</span>}>
      <ul className="contents">
        {visible.map((gap) => (
          <li key={gap.id} className="tt-row">
            {/* Days untouched, in the figure column. */}
            <span className="tt-n tt-latin">{daysSince(gap.updatedAt)}</span>
            <div className="tt-label min-w-0">
              <ContentText className="truncate">{gap.title}</ContentText>
            </div>
            {/* Both buttons are equal weight. Making "I've got it now" the
                primary would be nudging toward the answer that shortens the
                list, which is the app's interest and not the student's. */}
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pending === gap.id}
                onClick={() => answer(gap.id, "LEARNING")}
              >
                {t.keep}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pending === gap.id}
                onClick={() => answer(gap.id, "MASTERED")}
              >
                {t.got}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </TtSection>
  );
}
