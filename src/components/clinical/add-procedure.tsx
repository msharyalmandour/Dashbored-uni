"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardList, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ContentText } from "@/components/ui/content-text";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useI18n } from "@/components/shared/i18n-provider";
import { createProcedureByHand } from "@/app/actions/procedure";
import { parseChecklist, MAX_STEPS } from "@/lib/checklist";

/**
 * Paste the sheet.
 *
 * The page this sits on had no way to add anything, on purpose: the comment
 * said a twelve-step checklist typed by hand costs the same as the shift form
 * that emptied the old page, and the checklist should come from the student's
 * own faculty PDF read once by the agent.
 *
 * That was right about typing and wrong about the only alternative. The agent
 * has produced nothing since 11 September, so "read once by the agent" has
 * meant zero procedures and an unreachable exam. And pasting is not typing: a
 * marking sheet is already a list of lines, and selecting it is one gesture.
 *
 * The preview below the box is the whole reason this is a dialog and not a
 * form. It shows what WILL be written, numbered, with the critical steps
 * marked — so the student checks the parse before it becomes rows, instead of
 * finding out on the procedure page that line one was a heading.
 */
export function AddProcedure({
  subjects,
  variant = "default",
}: {
  subjects: { id: string; name: string }[];
  variant?: "default" | "quiet";
}) {
  const { dict } = useI18n();
  const t = dict.clinical.add;
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [stepsText, setStepsText] = React.useState("");
  const [subjectId, setSubjectId] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  // Parsed on every keystroke rather than on submit. It is a pure function
  // over a string the user is already looking at, and seeing the steps appear
  // as you paste is what makes the numbering rule legible without explaining it.
  const parsed = React.useMemo(() => parseChecklist(stepsText), [stepsText]);
  const criticalCount = parsed.filter((s) => s.critical).length;
  const atCap = parsed.length === MAX_STEPS;

  async function save() {
    if (!name.trim() || parsed.length === 0) return;
    setBusy(true);
    try {
      const res = await createProcedureByHand({
        name,
        stepsText,
        subjectId: subjectId || null,
      });
      if (!res.ok) {
        toast.error(t.noSteps);
        return;
      }
      setOpen(false);
      setName("");
      setStepsText("");
      setSubjectId("");
      // Straight to the station, which is the thing they came to do. A toast
      // and a closed dialog would leave them on a list to find it again.
      router.push(`/clinical/${res.procedureId}`);
    } catch {
      toast.error(dict.common.somethingWentWrong);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant === "quiet" ? "outline" : "default"} size="sm">
          <ClipboardList className="size-4" />
          {t.trigger}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.subtitle}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="proc-name">{t.nameLabel}</Label>
            <Input
              id="proc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.namePlaceholder}
              dir="auto"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="proc-steps">{t.stepsLabel}</Label>
            <Textarea
              id="proc-steps"
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
              placeholder={t.stepsPlaceholder}
              rows={8}
              dir="auto"
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">{t.stepsHint}</p>
          </div>

          {subjects.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="proc-subject">{t.courseLabel}</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger id="proc-subject">
                  <SelectValue placeholder={t.coursePlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Said plainly rather than enforced. A sheet that names no
                  course is still worth keeping; it just cannot record a miss
                  until it has one, because a Mistake needs a course. */}
              <p className="text-xs text-muted-foreground">{t.courseHint}</p>
            </div>
          )}

          {/* What will actually be written. */}
          {parsed.length > 0 && (
            <div className="rounded-[var(--radius)] border border-[color:var(--border)] p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {t.previewTitle.replace("{count}", String(parsed.length))}
                {criticalCount > 0 && ` · ${t.previewCritical.replace("{count}", String(criticalCount))}`}
              </p>
              <ol className="flex flex-col gap-1">
                {parsed.map((s, i) => (
                  <li key={i} className="flex gap-2 text-xs">
                    <span className="w-5 shrink-0 text-end tabular-nums text-muted-foreground">
                      {i + 1}.
                    </span>
                    <ContentText as="span" className="min-w-0 flex-1">
                      {s.text}
                    </ContentText>
                    {s.critical && (
                      <span className="shrink-0 text-[color:var(--destructive)]">
                        {t.criticalTag}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
              {atCap && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-[color:var(--warning,#b45309)]">
                  <AlertTriangle className="size-3 shrink-0" />
                  {t.capped.replace("{max}", String(MAX_STEPS))}
                </p>
              )}
              {/* The one thing the parse cannot know, said once. */}
              {criticalCount === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">{t.noCriticalYet}</p>
              )}
            </div>
          )}

          <Button onClick={save} disabled={busy || !name.trim() || parsed.length === 0}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {t.save}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
