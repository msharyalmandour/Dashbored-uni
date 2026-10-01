"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentText } from "@/components/ui/content-text";
import { TtRow, TtEmpty } from "@/components/shared/tt";
import { completeReviewItem, skipReviewItem } from "@/app/actions/review";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/components/shared/i18n-provider";

export interface ReviewRow {
  id: string;
  type: "LECTURE" | "TOPIC" | "FLASHCARD" | "KNOWLEDGE_GAP" | "MISTAKE";
  title: string;
  href: string;
  subjectName: string;
  subjectColor: string;
  scheduledDate: string;
  reviewStage: string;
}

/**
 * The rows of one review section.
 *
 * The type badge that used to sit on every row is gone: these rows are already
 * inside a section that names their type, and a label repeated sixty-nine times
 * is decoration. What is left is the thing itself, which subject it belongs to,
 * and how many times it has come back before.
 */
export function ReviewList({ items }: { items: ReviewRow[] }) {
  const { dict, locale } = useI18n();
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());

  async function handle(id: string, action: "complete" | "skip") {
    setDismissed((s) => new Set(s).add(id));
    try {
      if (action === "complete") {
        await completeReviewItem(id);
        toast.success(dict.review.markReviewed);
      } else {
        await skipReviewItem(id);
      }
    } catch {
      toast.error(dict.common.somethingWentWrong);
      setDismissed((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  }

  const visible = items.filter((i) => !dismissed.has(i.id));

  if (visible.length === 0) {
    return <TtEmpty>{dict.review.sectionEmpty}</TtEmpty>;
  }

  return (
    <>
      {visible.map((item) => (
        <TtRow key={item.id}>
          {/* THE FIGURE IS HOW MANY TIMES IT HAS COME BACK, which is the one
              number on a review row that tells you anything: a card returning
              for the fifth time is a different problem from one you have never
              answered. The stage label ("Day 3") that used to carry this was a
              rung on a scheduler's ladder, which is a fact about the scheduler. */}
          <span className="tt-n tt-latin">{item.reviewStage}</span>

          <Link href={item.href} className="tt-label flex min-w-0 items-center gap-2 hover:underline">
            {/* The course, as a dot rather than its name. Forty rows each
                carrying "NURC (410) Critical Care Nursing" is the course name
                forty times; a dot in the course's own colour is the same fact
                in two pixels, and the title gets the width back. */}
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.subjectColor }}
              title={item.subjectName}
            />
            {/* The student's own material: a lecture title, a flashcard front.
                Almost always English on an Arabic page, so it states its own
                direction rather than inheriting the paragraph's. */}
            <ContentText className="truncate">{item.title}</ContentText>
          </Link>

          <span className="flex shrink-0 items-center gap-1.5">
            {/* When it came due. Every row here is due, so this says how long
                it has been waiting — which is the difference between a card
                from this morning and one from three weeks ago. */}
            <span className="tt-meta hidden tabular-nums sm:inline">
              {formatDate(item.scheduledDate, locale)}
            </span>
            <Button size="sm" variant="ghost" onClick={() => handle(item.id, "skip")}>
              <SkipForward className="size-3.5" />
              <span className="sr-only sm:not-sr-only">{dict.review.skip}</span>
            </Button>
            {/* Secondary, not primary. There is one of these per row and the
                list runs to forty: a screen of domed accent buttons says every
                row is the most important thing on the page, which is the same
                as saying none of them is. */}
            <Button size="sm" variant="secondary" onClick={() => handle(item.id, "complete")}>
              <Check className="size-3.5" />
              <span className="sr-only sm:not-sr-only">{dict.review.markReviewed}</span>
            </Button>
          </span>
        </TtRow>
      ))}
    </>
  );
}
