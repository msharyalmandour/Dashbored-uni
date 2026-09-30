"use client";

import * as React from "react";
import { toast } from "sonner";
import { FolderInput } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/shared/i18n-provider";
import { fileProcedure } from "@/app/actions/procedure";

/**
 * "Which course is this?" — asked once, only when the answer is missing.
 *
 * A procedure sheet frequently names no course: it is "Nasogastric Tube
 * Insertion", full stop. The agent files it nowhere rather than guessing,
 * because guessing a destination is what produced a book masquerading as a
 * course in this student's own list. So the question is put to the person who
 * knows, and it is put once.
 *
 * A plain select rather than a dialog, because it is one field and a dialog
 * would make a one-tap answer feel like a form.
 */
export function FileProcedure({
  procedureId,
  subjects,
}: {
  procedureId: string;
  subjects: { id: string; name: string }[];
}) {
  const { dict } = useI18n();
  const t = dict.clinical;
  const [subjectId, setSubjectId] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  // Nothing to choose from is not a prompt worth showing — it would ask a
  // question with no available answer.
  if (subjects.length === 0) return null;

  async function save() {
    if (!subjectId) return;
    setBusy(true);
    try {
      await fileProcedure(procedureId, subjectId);
      toast.success(t.filed);
    } catch {
      toast.error(dict.common.somethingWentWrong);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[color:var(--border-active)] bg-[color:var(--card)] px-4 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <FolderInput className="mt-0.5 size-4 shrink-0 text-[color:var(--primary)]" />
        <div className="min-w-0">
          <p className="text-sm font-medium">{t.fileItHeading}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t.fileItHint}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <label htmlFor="procedure-subject" className="sr-only">
          {t.fileItHeading}
        </label>
        <select
          id="procedure-subject"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          className="h-9 min-w-0 rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] px-2 text-sm"
        >
          <option value="">{t.chooseCourse}</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={save} disabled={busy || !subjectId}>
          {t.fileIt}
        </Button>
      </div>
    </div>
  );
}
