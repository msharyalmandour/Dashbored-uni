"use client";

import * as React from "react";
import { DifficultyBadge, ProblemStatusBadge } from "@/components/shared/status-badges";
import { ProblemAttemptDialog, type AttemptProblem } from "@/components/problems/problem-attempt-dialog";
import { Button } from "@/components/ui/button";

export interface ProblemRow extends AttemptProblem {
  status: string;
}

export function ProblemsList({ problems }: { problems: ProblemRow[] }) {
  const [active, setActive] = React.useState<ProblemRow | null>(null);

  return (
    <>
      <div className="flex flex-col gap-2">
        {problems.length === 0 && (
          <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            No problems match these filters.
          </p>
        )}
        {problems.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{p.question}</p>
              <p className="text-xs text-muted-foreground">{p.subjectName}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <DifficultyBadge difficulty={p.difficulty} />
              <ProblemStatusBadge status={p.status} />
              <Button size="sm" variant="secondary" onClick={() => setActive(p)}>
                {p.status === "NOT_ATTEMPTED" ? "Attempt" : "Retry"}
              </Button>
            </div>
          </div>
        ))}
      </div>
      <ProblemAttemptDialog
        key={active?.id ?? "none"}
        problem={active}
        open={!!active}
        onOpenChange={(o) => !o && setActive(null)}
      />
    </>
  );
}
