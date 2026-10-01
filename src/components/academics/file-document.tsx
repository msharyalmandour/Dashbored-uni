"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/components/shared/i18n-provider";
import { fileDocumentUnderLecture } from "@/app/actions/documents";

/**
 * "Which lecture is this?" — one question, one tap, and the row leaves.
 *
 * The 277 pages this exists for were read successfully and then filed nowhere,
 * because filing was the agent's job. So the question the agent could not
 * answer is put to the person who already knows it, in the place where they
 * can see the lecture list to answer from.
 *
 * A bare select rather than a dialog: it is one field, and a dialog would turn
 * a one-tap answer into a form. The same decision file-procedure.tsx made, for
 * the same reason.
 */
export function FileDocument({
  documentId,
  lectures,
  subjectName,
}: {
  documentId: string;
  lectures: { id: string; label: string }[];
  subjectName: string;
}) {
  const { dict } = useI18n();
  const t = dict.subject;
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  /* No lectures to file it under is not a prompt worth showing — it asks a
     question with no available answer. The course needs a lecture first, and
     the section above this one is where that happens. */
  if (lectures.length === 0) {
    return <span className="tt-meta">{t.needsALectureFirst}</span>;
  }

  async function choose(lectureId: string) {
    setBusy(true);
    try {
      await fileDocumentUnderLecture(documentId, lectureId);
      toast.success(t.filedUnder.replace("{course}", subjectName));
      router.refresh();
    } catch {
      toast.error(dict.common.somethingWentWrong);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Select disabled={busy} onValueChange={choose}>
      <SelectTrigger className="h-8 w-auto min-w-[9rem] gap-1.5 border-0 bg-transparent px-2 text-xs shadow-none hover:bg-[color:var(--accent)]">
        <SelectValue placeholder={t.whichLecture} />
      </SelectTrigger>
      <SelectContent>
        {lectures.map((l) => (
          <SelectItem key={l.id} value={l.id} className="text-xs">
            {l.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
