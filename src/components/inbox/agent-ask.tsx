"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/shared/i18n-provider";

/**
 * The one question this flow ever asks.
 *
 * Every other outcome either has enough signal to act on or doesn't and gets
 * filed — this is the single case the schema can name as genuinely
 * ambiguous: a course the model recognised that the student does not have
 * yet. Creating a course adds a whole new object to someone's academic
 * structure, which is the one write in this flow worth a yes/no rather than
 * a guess in either direction. Deliberately not a form: one line, two
 * buttons, no course picker, no title field.
 */
export function AgentAsk({
  subjectName,
  busy,
  onYes,
  onNo,
}: {
  subjectName: string;
  busy: boolean;
  onYes: () => void;
  onNo: () => void;
}) {
  const { dict, format } = useI18n();
  const t = dict.inbox;

  return (
    <div className="orb-emerge mt-4 flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <HelpCircle className="size-4 shrink-0 text-primary" />
        {format(t.askSubjectQuestion, { course: subjectName })}
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onYes} disabled={busy} className="flex-1">
          {t.yesSetItUp}
        </Button>
        <Button size="sm" variant="outline" onClick={onNo} disabled={busy} className="flex-1">
          {t.noJustSaveIt}
        </Button>
      </div>
    </div>
  );
}
