"use client";

import * as React from "react";
import { Eye } from "lucide-react";
import { useI18n } from "@/components/shared/i18n-provider";
import type { ReviewFinding } from "@/lib/ai/agent/review";

/**
 * What reading the rows back turned up.
 *
 * Presented as something to glance at, not as an error, because that is what it
 * is: every finding here is a suspicion the student can settle in a second and
 * the app cannot settle at all. A deadline in the past is perfectly normal for a
 * syllabus dropped mid-semester; some clinical rotations really do start at 5am;
 * "Pharmacology II" beside "Pharmacology" is sometimes two real courses. So this
 * shows what was written and lets them decide, rather than correcting a row on a
 * guess — which would trade a visible oddity for an invisible fabrication.
 *
 * It sits with the list of what happened, while they are still looking at it and
 * can still remember what they dropped.
 */
export function ReviewNotes({ findings }: { findings: ReviewFinding[] }) {
  const { dict, format } = useI18n();
  const t = dict.inbox;

  if (findings.length === 0) return null;

  const line = (finding: ReviewFinding): string => {
    const d = finding.detail;
    switch (finding.code) {
      case "DEADLINE_IN_PAST":
        return format(t.reviewDeadlineInPast, { title: d.title, date: d.date });
      case "DEADLINE_FAR_OFF":
        return format(t.reviewDeadlineFarOff, { title: d.title, date: d.date });
      case "CLASS_AT_ODD_HOUR":
        return format(t.reviewClassOddHour, { title: d.title, time: d.time });
      case "COURSE_LOOKS_DUPLICATE":
        return format(t.reviewCourseDuplicate, { created: d.created, existing: d.existing });
      case "LECTURE_NUMBER_TAKEN":
        return format(t.reviewLectureNumberTaken, { title: d.title, number: d.number, other: d.other });
      case "A_LOT_OF_FLASHCARDS":
        return format(t.reviewFlashcards, { count: d.count });
      default:
        return "";
    }
  };

  return (
    <div className="w-full rounded-lg border border-border-subtle bg-surface-secondary/60 p-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Eye className="size-3.5" />
        {t.reviewHeading}
      </p>
      <ul className="flex flex-col gap-1">
        {findings.map((finding, index) => {
          const text = line(finding);
          if (!text) return null;
          return (
            <li key={`${finding.code}-${index}`} className="text-xs text-foreground/75">
              {text}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
