"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { updateMistakeStatus } from "@/app/actions/mistakes";
import type { MistakeStatus } from "@prisma/client";

const TYPE_LABEL: Record<string, string> = {
  KNOWLEDGE_GAP: "Knowledge Gap",
  MISUNDERSTANDING: "Misunderstanding",
  MEMORY_ERROR: "Memory Error",
  CARELESS_MISTAKE: "Careless Mistake",
  QUESTION_MISINTERPRETATION: "Misread the Question",
};

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

export function MistakeRow({ mistake }: { mistake: MistakeRowData }) {
  const router = useRouter();
  const [status, setStatus] = React.useState(mistake.status);
  const [pending, startTransition] = React.useTransition();

  function onChange(next: string) {
    setStatus(next as MistakeStatus);
    startTransition(async () => {
      await updateMistakeStatus(mistake.id, next as MistakeStatus);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{TYPE_LABEL[mistake.mistakeType] ?? mistake.mistakeType}</Badge>
          <span className="text-xs text-muted-foreground">
            {mistake.subjectName}
            {mistake.topicName ? ` · ${mistake.topicName}` : ""}
          </span>
          {mistake.frequency > 1 && (
            <Badge variant="warning">{mistake.frequency}x repeated</Badge>
          )}
        </div>
        <Select value={status} onValueChange={onChange} disabled={pending}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="REVIEWING">Reviewing</SelectItem>
            <SelectItem value="RESOLVED">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {mistake.whyIGotItWrong && (
        <p className="text-sm">
          <span className="text-muted-foreground">Why: </span>
          {mistake.whyIGotItWrong}
        </p>
      )}
      {mistake.correctConcept && (
        <p className="mt-1 text-sm">
          <span className="text-muted-foreground">Correct concept: </span>
          {mistake.correctConcept}
        </p>
      )}
      {mistake.whatIShouldReview && (
        <p className="mt-1 text-sm">
          <span className="text-muted-foreground">Review: </span>
          {mistake.whatIShouldReview}
        </p>
      )}
    </div>
  );
}
