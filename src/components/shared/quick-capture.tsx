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

interface CaptureTypeDef {
  type: QuickCaptureType;
  label: string;
  icon: typeof Plus;
  needsSubject: boolean;
}

const CAPTURE_TYPES: CaptureTypeDef[] = [
  { type: "TASK", label: "Task / Deadline", icon: CheckSquare, needsSubject: false },
  { type: "KNOWLEDGE_GAP", label: "Knowledge Gap", icon: Lightbulb, needsSubject: true },
  { type: "FLASHCARD", label: "Flashcard", icon: Layers, needsSubject: true },
  { type: "PROBLEM", label: "Problem", icon: PencilLine, needsSubject: true },
  { type: "MISTAKE", label: "Mistake", icon: AlertTriangle, needsSubject: true },
  { type: "TRAINING_NOTE", label: "Training Note", icon: Stethoscope, needsSubject: false },
  { type: "VIDEO", label: "Video", icon: Video, needsSubject: false },
  { type: "LECTURE", label: "Lecture", icon: BookOpen, needsSubject: true },
];

export function QuickCapture() {
  const router = useRouter();
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
      toast.success(`${selected.label} captured`, {
        description: "Organize the details later — it's saved.",
      });
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save that. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="lg"
        className="fixed bottom-20 right-5 z-40 h-14 w-14 rounded-full p-0 shadow-lg shadow-primary/30 md:bottom-6 md:right-6 md:h-12 md:w-auto md:px-5"
      >
        <Plus className="size-5" />
        <span className="hidden md:inline">Quick Capture</span>
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          {!selected ? (
            <>
              <DialogHeader>
                <DialogTitle>Quick Capture</DialogTitle>
                <DialogDescription>Capture now. Organize later.</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-2">
                {CAPTURE_TYPES.map((ct) => (
                  <button
                    key={ct.type}
                    onClick={() => setSelected(ct)}
                    className="flex flex-col items-start gap-2 rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent"
                  >
                    <ct.icon className="size-5 text-primary" />
                    <span className="text-sm font-medium">{ct.label}</span>
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
                  <ArrowLeft className="size-3.5" /> Back
                </button>
                <DialogTitle className="flex items-center gap-2">
                  <selected.icon className="size-4 text-primary" />
                  {selected.label}
                </DialogTitle>
              </DialogHeader>

              {selected.needsSubject && (
                <div className="space-y-1.5">
                  <Label>Subject</Label>
                  <Select value={subjectId} onValueChange={setSubjectId} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a subject" />
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
                  <Label>Subject (optional)</Label>
                  <Select value={subjectId} onValueChange={setSubjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder="No subject" />
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

              <QuickCaptureFields type={selected.type} setField={setField} />

              <Button type="submit" disabled={saving} className="mt-1">
                {saving && <Loader2 className="size-4 animate-spin" />}
                Save
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
}: {
  type: QuickCaptureType;
  setField: (key: string, value: string) => void;
}) {
  const onChange =
    (key: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setField(key, e.target.value);

  switch (type) {
    case "TASK":
      return (
        <>
          <Field label="Title" required>
            <Input onChange={onChange("title")} placeholder="Submit lab report" required />
          </Field>
          <Field label="Deadline" required>
            <Input type="datetime-local" onChange={onChange("deadline")} required />
          </Field>
        </>
      );
    case "KNOWLEDGE_GAP":
      return (
        <>
          <Field label="What don't you understand?" required>
            <Input onChange={onChange("title")} placeholder="e.g. Drug distribution" required />
          </Field>
          <Field label="Details">
            <Textarea onChange={onChange("description")} placeholder="Optional context" />
          </Field>
        </>
      );
    case "FLASHCARD":
      return (
        <>
          <Field label="Front" required>
            <Textarea onChange={onChange("front")} placeholder="Question / prompt" required />
          </Field>
          <Field label="Back" required>
            <Textarea onChange={onChange("back")} placeholder="Answer" required />
          </Field>
        </>
      );
    case "PROBLEM":
      return (
        <>
          <Field label="Question" required>
            <Textarea onChange={onChange("question")} required />
          </Field>
          <Field label="Correct answer" required>
            <Textarea onChange={onChange("correctAnswer")} required />
          </Field>
        </>
      );
    case "MISTAKE":
      return (
        <>
          <Field label="Why did you get it wrong?" required>
            <Textarea onChange={onChange("whyIGotItWrong")} required />
          </Field>
          <Field label="What should you review?">
            <Input onChange={onChange("whatIShouldReview")} />
          </Field>
        </>
      );
    case "TRAINING_NOTE":
      return (
        <>
          <Field label="Hospital / Site">
            <Input onChange={onChange("hospital")} />
          </Field>
          <Field label="Reflection" required>
            <Textarea onChange={onChange("reflection")} placeholder="What happened today?" required />
          </Field>
          <Field label="What didn't you understand?">
            <Textarea onChange={onChange("whatIDidNotUnderstand")} />
          </Field>
        </>
      );
    case "VIDEO":
      return (
        <>
          <Field label="Title" required>
            <Input onChange={onChange("title")} required />
          </Field>
          <Field label="URL" required>
            <Input onChange={onChange("url")} placeholder="https://" required />
          </Field>
        </>
      );
    case "LECTURE":
      return (
        <>
          <Field label="Title" required>
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
