"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  addLectureResource,
  addLectureGap,
  addLectureFlashcard,
  addLectureProblem,
} from "@/app/actions/lecture";
import type { Difficulty, ResourceType } from "@prisma/client";

interface LectureCtx {
  lectureId: string;
  subjectId: string;
  topicId: string | null;
}

function useSaveHandler(onSave: () => Promise<void>) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  async function run() {
    setSaving(true);
    try {
      await onSave();
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return { open, setOpen, saving, run };
}

function DifficultySelect({ value, onChange }: { value: Difficulty; onChange: (v: Difficulty) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Difficulty)}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="EASY">Easy</SelectItem>
        <SelectItem value="MEDIUM">Medium</SelectItem>
        <SelectItem value="HARD">Hard</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function AddResourceDialog({ lectureId }: LectureCtx) {
  const [type, setType] = React.useState<ResourceType>("PDF" as ResourceType);
  const [title, setTitle] = React.useState("");
  const [url, setUrl] = React.useState("");
  const { open, setOpen, saving, run } = useSaveHandler(() =>
    addLectureResource({ lectureId, type, title, url })
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Plus className="size-3.5" /> Add
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Resource</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ResourceType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PDF">PDF</SelectItem>
                <SelectItem value="POWERPOINT">PowerPoint</SelectItem>
                <SelectItem value="VIDEO">Video</SelectItem>
                <SelectItem value="LINK">Link</SelectItem>
                <SelectItem value="NOTE">Note</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lecture slides" />
          </div>
          <div className="space-y-1.5">
            <Label>URL (optional)</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
          </div>
          <Button onClick={run} disabled={saving || !title}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AddGapDialog({ lectureId, subjectId, topicId }: LectureCtx) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [difficulty, setDifficulty] = React.useState<Difficulty>("MEDIUM" as Difficulty);
  const { open, setOpen, saving, run } = useSaveHandler(() =>
    addLectureGap({ lectureId, subjectId, topicId, title, description, difficulty })
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Plus className="size-3.5" /> Add
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>What don&apos;t you understand?</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Drug distribution" />
          </div>
          <div className="space-y-1.5">
            <Label>Details</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Difficulty</Label>
            <DifficultySelect value={difficulty} onChange={setDifficulty} />
          </div>
          <Button onClick={run} disabled={saving || !title}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save Knowledge Gap
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AddFlashcardDialog({ lectureId, subjectId, topicId }: LectureCtx) {
  const [front, setFront] = React.useState("");
  const [back, setBack] = React.useState("");
  const [difficulty, setDifficulty] = React.useState<Difficulty>("MEDIUM" as Difficulty);
  const { open, setOpen, saving, run } = useSaveHandler(() =>
    addLectureFlashcard({ lectureId, subjectId, topicId, front, back, difficulty })
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Plus className="size-3.5" /> Add
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Flashcard</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label>Front</Label>
            <Textarea value={front} onChange={(e) => setFront(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Back</Label>
            <Textarea value={back} onChange={(e) => setBack(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Difficulty</Label>
            <DifficultySelect value={difficulty} onChange={setDifficulty} />
          </div>
          <Button onClick={run} disabled={saving || !front || !back}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save Flashcard
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AddProblemDialog({ lectureId, subjectId, topicId }: LectureCtx) {
  const [question, setQuestion] = React.useState("");
  const [correctAnswer, setCorrectAnswer] = React.useState("");
  const [difficulty, setDifficulty] = React.useState<Difficulty>("MEDIUM" as Difficulty);
  const { open, setOpen, saving, run } = useSaveHandler(() =>
    addLectureProblem({ lectureId, subjectId, topicId, question, correctAnswer, difficulty })
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Plus className="size-3.5" /> Add
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Practice Question</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label>Question</Label>
            <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Correct answer</Label>
            <Textarea value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Difficulty</Label>
            <DifficultySelect value={difficulty} onChange={setDifficulty} />
          </div>
          <Button onClick={run} disabled={saving || !question || !correctAnswer}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save Question
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
