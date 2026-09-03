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
import { createKnowledgeGap } from "@/app/actions/knowledge-gap";
import type { Difficulty, GapSource } from "@prisma/client";
import type { FilterSubject, FilterLecture, FilterTopic } from "@/components/knowledge-gaps/gap-filter-bar";

export function AddGapDialog({
  subjects,
  lectures,
  topics,
}: {
  subjects: FilterSubject[];
  lectures: FilterLecture[];
  topics: FilterTopic[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [subjectId, setSubjectId] = React.useState("");
  const [lectureId, setLectureId] = React.useState("");
  const [topicId, setTopicId] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [difficulty, setDifficulty] = React.useState<Difficulty>("MEDIUM" as Difficulty);
  const [source, setSource] = React.useState<GapSource>("OTHER" as GapSource);

  const filteredLectures = lectures.filter((l) => l.subjectId === subjectId);
  const filteredTopics = topics.filter((t) => t.subjectId === subjectId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createKnowledgeGap({
        subjectId,
        lectureId: lectureId || undefined,
        topicId: topicId || undefined,
        title,
        description,
        difficulty,
        source,
      });
      toast.success("Knowledge gap captured");
      setOpen(false);
      setTitle("");
      setDescription("");
      router.refresh();
    } catch {
      toast.error("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> New Knowledge Gap
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>What don&apos;t you understand?</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Drug distribution" required />
          </div>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setLectureId(""); setTopicId(""); }} required>
              <SelectTrigger><SelectValue placeholder="Choose a subject" /></SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {subjectId && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Lecture (optional)</Label>
                <Select value={lectureId} onValueChange={setLectureId}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    {filteredLectures.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Topic (optional)</Label>
                <Select value={topicId} onValueChange={setTopicId}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    {filteredTopics.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Details</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional context" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EASY">Easy</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HARD">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={source} onValueChange={(v) => setSource(v as GapSource)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LECTURE">Lecture</SelectItem>
                  <SelectItem value="CLINICAL_TRAINING">Clinical Training</SelectItem>
                  <SelectItem value="VIDEO">Video</SelectItem>
                  <SelectItem value="PROBLEM_SOLVING">Problem Solving</SelectItem>
                  <SelectItem value="READING">Reading</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" disabled={saving || !subjectId || !title}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save Knowledge Gap
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
