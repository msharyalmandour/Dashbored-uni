"use client";

import * as React from "react";
import { DifficultyBadge, ProblemStatusBadge } from "@/components/shared/status-badges";
import { ProblemAttemptDialog, type AttemptProblem } from "@/components/problems/problem-attempt-dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/shared/i18n-provider";
import { OSSection, OSRow, OSEmptyState } from "@/components/shared/os-section";
import { OSRowGroup } from "@/components/shared/os-row-group";
import { ContentText } from "@/components/ui/content-text";
import { OriginLink } from "@/components/shared/origin-link";
import { DeleteThing } from "@/components/shared/delete-thing";

export interface ProblemRow extends AttemptProblem {
  status: string;
  /** Where the question came from, so the row can lead back to it. */
  lecture?: { id: string; title: string } | null;
  subjectId?: string;
}

export function ProblemsList({ problems }: { problems: ProblemRow[] }) {
  const { dict } = useI18n();
  const [active, setActive] = React.useState<ProblemRow | null>(null);

  return (
    <>
      <OSSection title={dict.problems.title} count={problems.length}>
        {problems.length === 0 ? (
          <OSEmptyState title={dict.problems.noMatch} />
        ) : (
          <OSRowGroup limit={8}>
            {problems.map((p) => (
              <OSRow key={p.id}>
                <div className="min-w-0 flex-1">
                  <ContentText as="p" className="truncate text-sm font-medium">
                    {p.question}
                  </ContentText>
                  {/* Was a bare subject name. A question you cannot trace to its
                      lecture is the end of the road, which is the one thing this
                      app is supposed not to be. */}
                  <OriginLink
                    className="mt-0.5"
                    lecture={p.lecture}
                    subject={p.subjectId ? { id: p.subjectId, name: p.subjectName } : null}
                  />
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <DifficultyBadge difficulty={p.difficulty} dict={dict} />
                  <ProblemStatusBadge status={p.status} dict={dict} />
                  <Button size="sm" variant="secondary" onClick={() => setActive(p)}>
                    {p.status === "NOT_ATTEMPTED" ? dict.problems.attempt : dict.problems.retry}
                  </Button>
                  <DeleteThing kind="problem" id={p.id} name={p.question} />
                </div>
              </OSRow>
            ))}
          </OSRowGroup>
        )}
      </OSSection>
      <ProblemAttemptDialog
        key={active?.id ?? "none"}
        problem={active}
        open={!!active}
        onOpenChange={(o) => !o && setActive(null)}
      />
    </>
  );
}
