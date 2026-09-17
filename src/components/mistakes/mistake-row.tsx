"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ContentText } from "@/components/ui/content-text";
import { updateMistakeStatus } from "@/app/actions/mistakes";
import type { MistakeStatus } from "@prisma/client";
import { useI18n } from "@/components/shared/i18n-provider";

export interface MistakeRowData {
  id: string;
  mistakeType: string;
  whyIGotItWrong: string | null;
  correctConcept: string | null;
  whatIShouldReview: string | null;
  frequency: number;
  status: MistakeStatus;
  subjectName: string;
  topicName: string | null;
}

/**
 * One mistake, inside the section that already names its kind.
 *
 * The type badge is gone from here for that reason. What is left is where it
 * happened, how often, and the three lines the student (or the model reading
 * their work) wrote about it — every one of which is their own text, so every
 * one states its own direction. Rendered inside an Arabic page without that,
 * an English reason gets its full stop moved to the front of the line.
 */
export function MistakeRow({ mistake }: { mistake: MistakeRowData }) {
  const router = useRouter();
  const { dict } = useI18n();
  const [status, setStatus] = React.useState(mistake.status);
  const [pending, startTransition] = React.useTransition();

  function onChange(next: string) {
    setStatus(next as MistakeStatus);
    startTransition(async () => {
      await updateMistakeStatus(mistake.id, next as MistakeStatus);
      router.refresh();
    });
  }

  const lines = [
    { label: dict.mistakes.why, value: mistake.whyIGotItWrong },
    { label: dict.mistakes.correctConceptLabel, value: mistake.correctConcept },
    { label: dict.mistakes.reviewLabel, value: mistake.whatIShouldReview },
  ].filter((l) => l.value);

  return (
    <div className="border-b border-[oklch(100%_0_0_/_5%)] px-4 py-3.5 last:border-b-0">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <ContentText className="text-xs text-muted-foreground">
            {mistake.subjectName}
            {mistake.topicName ? ` · ${mistake.topicName}` : ""}
          </ContentText>
          {mistake.frequency > 1 && (
            <Badge variant="warning">
              {mistake.frequency}× {dict.mistakes.repeated}
            </Badge>
          )}
        </div>
        <Select value={status} onValueChange={onChange} disabled={pending}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="OPEN">{dict.status.mistake.OPEN}</SelectItem>
            <SelectItem value="REVIEWING">{dict.status.mistake.REVIEWING}</SelectItem>
            <SelectItem value="RESOLVED">{dict.status.mistake.RESOLVED}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {lines.map((line) => (
        <p key={line.label} className="mt-1 text-sm first:mt-0">
          <span className="text-muted-foreground">{line.label} </span>
          <ContentText>{line.value}</ContentText>
        </p>
      ))}
    </div>
  );
}
