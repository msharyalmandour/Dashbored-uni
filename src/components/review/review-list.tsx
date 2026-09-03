"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, SkipForward, BookOpen, Layers, Lightbulb, AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { completeReviewItem, skipReviewItem } from "@/app/actions/review";
import { formatDate } from "@/lib/utils";

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

const TYPE_ICON = {
  LECTURE: BookOpen,
  TOPIC: Layers,
  FLASHCARD: Layers,
  KNOWLEDGE_GAP: Lightbulb,
  MISTAKE: AlertTriangle,
};

export function ReviewList({ items }: { items: ReviewRow[] }) {
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());

  async function handle(id: string, action: "complete" | "skip") {
    setDismissed((s) => new Set(s).add(id));
    try {
      if (action === "complete") {
        await completeReviewItem(id);
        toast.success("Marked reviewed");
      } else {
        await skipReviewItem(id);
      }
    } catch {
      toast.error("Something went wrong");
      setDismissed((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  }

  const visible = items.filter((i) => !dismissed.has(i.id));

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-14 text-center">
        <RotateCcw className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium">All caught up</p>
        <p className="text-xs text-muted-foreground">No reviews due right now.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {visible.map((item) => {
        const Icon = TYPE_ICON[item.type];
        return (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <Link href={item.href} className="truncate text-sm font-medium hover:text-primary">
                  {item.title}
                </Link>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span style={{ color: item.subjectColor }}>{item.subjectName}</span>
                  <span>· {item.reviewStage.replace("_", " ")}</span>
                  <span>· Scheduled {formatDate(item.scheduledDate)}</span>
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="secondary">{item.type.replace("_", " ")}</Badge>
              <Button size="sm" variant="ghost" onClick={() => handle(item.id, "skip")}>
                <SkipForward className="size-3.5" /> Skip
              </Button>
              <Button size="sm" onClick={() => handle(item.id, "complete")}>
                <Check className="size-3.5" /> Mark Reviewed
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
