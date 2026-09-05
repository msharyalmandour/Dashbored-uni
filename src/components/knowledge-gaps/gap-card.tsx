"use client";

import { Layers, AlertTriangle, BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DifficultyBadge } from "@/components/shared/status-badges";
import { Badge } from "@/components/ui/badge";
import type { GapListItem } from "@/lib/knowledge-gaps";
import { useI18n } from "@/components/shared/i18n-provider";

const SOURCE_LABEL: Record<string, string> = {
  LECTURE: "Lecture",
  CLINICAL_TRAINING: "Clinical Training",
  VIDEO: "Video",
  PROBLEM_SOLVING: "Problem Solving",
  READING: "Reading",
  OTHER: "Other",
};

export function GapCard({ gap, onClick }: { gap: GapListItem; onClick: () => void }) {
  const { dict } = useI18n();
  return (
    <Card interactive onClick={onClick} className="p-3.5">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{gap.title}</p>
        <DifficultyBadge difficulty={gap.difficulty} dict={dict} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span
          className="flex items-center gap-1 rounded-full px-1.5 py-0.5"
          style={{ backgroundColor: `${gap.subjectColor}22`, color: gap.subjectColor }}
        >
          {gap.subjectName}
        </span>
        <span>· {SOURCE_LABEL[gap.source] ?? gap.source}</span>
      </div>
      {(gap.lectureTitle || gap.topicName) && (
        <p className="mt-1.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
          <BookOpen className="size-3 shrink-0" />
          {gap.lectureTitle ?? gap.topicName}
        </p>
      )}
      <div className="mt-2.5 flex items-center gap-3 border-t border-border pt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <AlertTriangle className="size-3" /> {gap.mistakeCount}
        </span>
        <span className="flex items-center gap-1">
          <Layers className="size-3" /> {gap.flashcardCount}
        </span>
        {gap.nextReviewDate && (
          <Badge variant="muted" className="ms-auto">
            {dict.knowledgeGaps.nextReview} {new Date(gap.nextReviewDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </Badge>
        )}
      </div>
    </Card>
  );
}
