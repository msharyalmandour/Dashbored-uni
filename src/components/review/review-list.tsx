"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentText } from "@/components/ui/content-text";
import { OSRow, OSEmptyState } from "@/components/shared/os-section";
import { OSRowGroup } from "@/components/shared/os-row-group";
import { completeReviewItem, skipReviewItem } from "@/app/actions/review";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/components/shared/i18n-provider";
import type { Dictionary } from "@/lib/i18n/dictionaries";

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
    return <OSEmptyState title={dict.review.sectionEmpty} />;
  }

  return (
    <div>
      <OSRowGroup>
        {visible.map((item) => (
        <OSRow key={item.id}>
          <div className="min-w-0 flex-1">
            <Link href={item.href} className="block hover:text-primary">
              {/* The student's own material: a lecture title, a flashcard front.
                  Almost always English on an Arabic page, so it states its own
                  direction rather than inheriting the paragraph's. */}
              <ContentText as="p" className="truncate text-sm font-medium">
                {item.title}
              </ContentText>
            </Link>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
              <ContentText style={{ color: item.subjectColor }}>{item.subjectName}</ContentText>
              <span aria-hidden>·</span>
              <span>
                {dict.review.stageLabels[
                  item.reviewStage as keyof Dictionary["review"]["stageLabels"]
                ] ?? item.reviewStage}
              </span>
              <span aria-hidden>·</span>
              <span>
                {dict.review.scheduled} {formatDate(item.scheduledDate, locale)}
              </span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => handle(item.id, "skip")}>
              <SkipForward className="size-3.5" /> {dict.review.skip}
            </Button>
            {/* Secondary, not primary. There is one of these per row and the
                list runs to forty: a screen of domed accent buttons says every
                row is the most important thing on the page, which is the same
                as saying none of them is. */}
            <Button size="sm" variant="secondary" onClick={() => handle(item.id, "complete")}>
              <Check className="size-3.5" /> {dict.review.markReviewed}
            </Button>
          </div>
          </OSRow>
        ))}
      </OSRowGroup>
    </div>
  );
}
