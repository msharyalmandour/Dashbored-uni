"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  CheckSquare,
  Lightbulb,
  Layers,
  PencilLine,
  AlertTriangle,
  Stethoscope,
  Video,
  BookOpen,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createQuickCapture,
  getQuickCaptureContext,
  type QuickCaptureType,
} from "@/app/actions/quick-capture";
import { useI18n } from "@/components/shared/i18n-provider";
import type { Dictionary } from "@/lib/i18n/dictionaries";

interface CaptureTypeDef {
  type: QuickCaptureType;
  labelKey: keyof Dictionary["quickCapture"]["types"];
  icon: typeof Plus;
  needsSubject: boolean;
}

const CAPTURE_TYPES: CaptureTypeDef[] = [
  { type: "TASK", labelKey: "task", icon: CheckSquare, needsSubject: false },
  { type: "KNOWLEDGE_GAP", labelKey: "knowledgeGap", icon: Lightbulb, needsSubject: true },
  { type: "FLASHCARD", labelKey: "flashcard", icon: Layers, needsSubject: true },
  { type: "PROBLEM", labelKey: "problem", icon: PencilLine, needsSubject: true },
  { type: "MISTAKE", labelKey: "mistake", icon: AlertTriangle, needsSubject: true },
  { type: "TRAINING_NOTE", labelKey: "trainingNote", icon: Stethoscope, needsSubject: false },
  { type: "VIDEO", labelKey: "video", icon: Video, needsSubject: false },
  { type: "LECTURE", labelKey: "lecture", icon: BookOpen, needsSubject: true },
];

export function QuickCapture() {
  const router = useRouter();
  const { dict, format } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<CaptureTypeDef | null>(null);
  const [subjects, setSubjects] = React.useState<{ id: string; name: string; color: string }[]>([]);
  const [subjectId, setSubjectId] = React.useState<string>("");
  const [fields, setFields] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      getQuickCaptureContext().then((ctx) => setSubjects(ctx.subjects));
    }
  }, [open]);

  function reset() {
    setSelected(null);
    setSubjectId("");
    setFields({});
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  function setField(key: string, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      await createQuickCapture({ type: selected.type, subjectId: subjectId || undefined, fields });
      toast.success(format(dict.quickCapture.captured, { label: dict.quickCapture.types[selected.labelKey] }), {
        description: dict.quickCapture.capturedDescription,
      });
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.quickCapture.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="lg"
        className="fixed bottom-20 end-5 z-40 h-14 w-14 rounded-full p-0 shadow-[0_0_28px_var(--glow-primary-strong)] md:bottom-6 md:end-6 md:h-12 md:w-auto md:px-5"
      >
        <Plus className="size-5" />
        <span className="hidden md:inline">{dict.shell.quickCapture}</span>
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          {!selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{dict.quickCapture.title}</DialogTitle>
                <DialogDescription>{dict.quickCapture.subtitle}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-2">
                {CAPTURE_TYPES.map((ct) => (
                  <button
                    key={ct.type}
                    onClick={() => setSelected(ct)}
                    className="flex flex-col items-start gap-2 rounded-lg border border-border p-3 text-start transition-colors hover:border-primary/50 hover:bg-accent"
                  >
                    <ct.icon className="size-5 text-primary" />
                    <span className="text-sm font-medium">{dict.quickCapture.types[ct.labelKey]}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <DialogHeader>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="mb-1 flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="size-3.5 rtl:rotate-180" /> {dict.quickCapture.back}
                </button>
                <DialogTitle className="flex items-center gap-2">
                  <selected.icon className="size-4 text-primary" />
                  {dict.quickCapture.types[selected.labelKey]}
                </DialogTitle>
              </DialogHeader>

              {selected.needsSubject && (
                <div className="space-y-1.5">
                  <Label>{dict.common.subject}</Label>
                  <Select value={subjectId} onValueChange={setSubjectId} required>
                    <SelectTrigger>
                      <SelectValue placeholder={dict.common.chooseSubject} />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <span className="flex items-center gap-2">
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: s.color }}
                            />
                            {s.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {!selected.needsSubject && subjects.length > 0 && (
                <div className="space-y-1.5">
                  <Label>
                    {dict.common.subject} ({dict.common.optional})
                  </Label>
                  <Select value={subjectId} onValueChange={setSubjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder={dict.common.none} />
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
              )}

              <QuickCaptureFields type={selected.type} setField={setField} dict={dict} />

              <Button type="submit" disabled={saving} className="mt-1">
                {saving && <Loader2 className="size-4 animate-spin" />}
                {dict.common.save}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function QuickCaptureFields({
  type,
  setField,
  dict,
}: {
  type: QuickCaptureType;
  setField: (key: string, value: string) => void;
  dict: Dictionary;
}) {
  const onChange =
    (key: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setField(key, e.target.value);

  switch (type) {
    case "TASK":
      return (
        <>
          <Field label={dict.common.title} required>
            <Input onChange={onChange("title")} placeholder={dict.quickCapture.placeholders.taskTitle} required />
          </Field>
          <Field label={dict.tasks.deadline} required>
            <Input type="datetime-local" onChange={onChange("deadline")} required />
          </Field>
        </>
      );
    case "KNOWLEDGE_GAP":
      return (
        <>
          <Field label={dict.knowledgeGaps.whatDontYouUnderstand} required>
            <Input onChange={onChange("title")} placeholder={dict.quickCapture.placeholders.gapTitle} required />
          </Field>
          <Field label={dict.knowledgeGaps.details}>
            <Textarea onChange={onChange("description")} placeholder={dict.knowledgeGaps.optionalDetails} />
          </Field>
        </>
      );
    case "FLASHCARD":
      return (
        <>
          <Field label={dict.flashcards.front} required>
            <Textarea onChange={onChange("front")} placeholder={dict.quickCapture.placeholders.question} required />
          </Field>
          <Field label={dict.flashcards.back} required>
            <Textarea onChange={onChange("back")} placeholder={dict.quickCapture.placeholders.answer} required />
          </Field>
        </>
      );
    case "PROBLEM":
      return (
        <>
          <Field label={dict.flashcards.question} required>
            <Textarea onChange={onChange("question")} required />
          </Field>
          <Field label={dict.problems.correctAnswerLabel} required>
            <Textarea onChange={onChange("correctAnswer")} required />
          </Field>
        </>
      );
    case "MISTAKE":
      return (
        <>
          <Field label={dict.problems.whyWrong} required>
            <Textarea onChange={onChange("whyIGotItWrong")} required />
          </Field>
          <Field label={dict.problems.whatToReview}>
            <Input onChange={onChange("whatIShouldReview")} />
          </Field>
        </>
      );
    case "TRAINING_NOTE":
      return (
        <>
          <Field label={dict.clinical.hospital}>
            <Input onChange={onChange("hospital")} />
          </Field>
          <Field label={dict.clinical.reflectionField} required>
            <Textarea onChange={onChange("reflection")} placeholder={dict.quickCapture.placeholders.whatHappened} required />
          </Field>
          <Field label={dict.clinical.whatDidNotUnderstand}>
            <Textarea onChange={onChange("whatIDidNotUnderstand")} />
          </Field>
        </>
      );
    case "VIDEO":
      return (
        <>
          <Field label={dict.common.title} required>
            <Input onChange={onChange("title")} required />
          </Field>
          <Field label={dict.videos.url} required>
            <Input onChange={onChange("url")} placeholder="https://" required />
          </Field>
        </>
      );
    case "LECTURE":
      return (
        <>
          <Field label={dict.common.title} required>
            <Input onChange={onChange("title")} required />
          </Field>
        </>
      );
    default:
      return null;
  }
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}
