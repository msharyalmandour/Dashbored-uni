"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createMistake } from "@/app/actions/mistakes";
import { useI18n } from "@/components/shared/i18n-provider";
import type { MistakeType } from "@prisma/client";

const KINDS: MistakeType[] = [
  "KNOWLEDGE_GAP",
  "MISUNDERSTANDING",
  "MEMORY_ERROR",
  "CARELESS_MISTAKE",
  "QUESTION_MISINTERPRETATION",
];

/**
 * Writing a mistake down.
 *
 * The journal had no door. A mistake could arrive from a wrong answer in the
 * problem bank, from a drop the agent read, or from quick capture — and from
 * nothing the student chose to write. Which meant the one moment the whole page
 * exists for, sitting down after an exam knowing exactly what went wrong, had
 * nowhere to go: the list could be read, filtered and ticked off, never added
 * to.
 *
 * `whyIGotItWrong` is the only field asked for, because it is the one that
 * carries the mistake. The other two are frequently unknown at the moment of
 * writing — a student who knew the correct concept would not have the mistake —
 * and demanding them is how a journal stops being written in.
 *
 * The lecture list is filtered to the chosen course, and choosing a different
 * course clears it: a mistake filed under the wrong lecture is worse than one
 * filed under none, because the record everything else reasons from is then
 * quietly wrong.
 */
export function CreateMistakeDialog({
  subjects,
  lectures,
}: {
  subjects: { id: string; name: string }[];
  lectures: { id: string; title: string; subjectId: string }[];
}) {
  const router = useRouter();
  const { dict } = useI18n();
  const M = dict.mistakes;

  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [subjectId, setSubjectId] = React.useState("");
  const [lectureId, setLectureId] = React.useState("");
  const [kind, setKind] = React.useState<MistakeType>("KNOWLEDGE_GAP");
  const [why, setWhy] = React.useState("");
  const [correct, setCorrect] = React.useState("");
  const [review, setReview] = React.useState("");

  const forCourse = lectures.filter((l) => l.subjectId === subjectId);

  function pickSubject(next: string) {
    setSubjectId(next);
    setLectureId("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createMistake({
        subjectId,
        mistakeType: kind,
        whyIGotItWrong: why,
        correctConcept: correct || undefined,
        whatIShouldReview: review || undefined,
        lectureId: lectureId || undefined,
      });
      toast.success(M.logged);
      setOpen(false);
      setWhy("");
      setCorrect("");
      setReview("");
      setLectureId("");
      router.refresh();
    } catch {
      toast.error(dict.forms.couldNotSave);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={subjects.length === 0}>
          <Plus className="size-4" /> {M.logMistake}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{M.logMistake}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{dict.common.subject}</Label>
              <Select value={subjectId} onValueChange={pickSubject}>
                <SelectTrigger>
                  <SelectValue placeholder={dict.forms.noneOption} />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{M.kindLabel}</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as MistakeType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {dict.status.mistakeType[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Only once a course is chosen, and only if that course has lectures.
              An empty select is a question with no answers in it. */}
          {forCourse.length > 0 && (
            <div className="space-y-1.5">
              <Label>{dict.common.lecture}</Label>
              <Select value={lectureId} onValueChange={setLectureId}>
                <SelectTrigger>
                  <SelectValue placeholder={dict.forms.noneOption} />
                </SelectTrigger>
                <SelectContent>
                  {forCourse.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{M.why}</Label>
            <Textarea
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              placeholder={M.whyPlaceholder}
              dir="auto"
              rows={2}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>{M.correctConceptLabel}</Label>
            <Textarea
              value={correct}
              onChange={(e) => setCorrect(e.target.value)}
              placeholder={M.correctPlaceholder}
              dir="auto"
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{M.reviewLabel}</Label>
            <Textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder={M.reviewPlaceholder}
              dir="auto"
              rows={2}
            />
          </div>

          <Button type="submit" disabled={saving || !subjectId || !why.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {dict.common.save}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
