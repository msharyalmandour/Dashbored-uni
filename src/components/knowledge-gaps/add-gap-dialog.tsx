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
import { useI18n } from "@/components/shared/i18n-provider";

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
  const { dict } = useI18n();
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
      toast.success(dict.forms.gapCaptured);
      setOpen(false);
      setTitle("");
      setDescription("");
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
        <Button size="sm">
          <Plus className="size-4" /> {dict.forms.newKnowledgeGap}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dict.forms.whatDontYouUnderstand}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label>{dict.common.title}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={dict.forms.egGapTitle} required />
          </div>
          <div className="space-y-1.5">
            <Label>{dict.common.subject}</Label>
            <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setLectureId(""); setTopicId(""); }} required>
              <SelectTrigger><SelectValue placeholder={dict.common.chooseSubject} /></SelectTrigger>
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
                <Label>{dict.forms.lectureOptional}</Label>
                <Select value={lectureId} onValueChange={setLectureId}>
                  <SelectTrigger><SelectValue placeholder={dict.forms.noneOption} /></SelectTrigger>
                  <SelectContent>
                    {filteredLectures.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{dict.forms.topicOptional}</Label>
                <Select value={topicId} onValueChange={setTopicId}>
                  <SelectTrigger><SelectValue placeholder={dict.forms.noneOption} /></SelectTrigger>
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
            <Label>{dict.forms.details}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={dict.forms.optionalContext} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{dict.common.difficulty}</Label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EASY">{dict.common.easy}</SelectItem>
                  <SelectItem value="MEDIUM">{dict.common.medium}</SelectItem>
                  <SelectItem value="HARD">{dict.common.hard}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{dict.forms.source}</Label>
              <Select value={source} onValueChange={(v) => setSource(v as GapSource)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LECTURE">{dict.knowledgeGaps.sourceLabels.LECTURE}</SelectItem>
                  <SelectItem value="CLINICAL_TRAINING">{dict.knowledgeGaps.sourceLabels.CLINICAL_TRAINING}</SelectItem>
                  <SelectItem value="VIDEO">{dict.knowledgeGaps.sourceLabels.VIDEO}</SelectItem>
                  <SelectItem value="PROBLEM_SOLVING">{dict.knowledgeGaps.sourceLabels.PROBLEM_SOLVING}</SelectItem>
                  <SelectItem value="READING">{dict.knowledgeGaps.sourceLabels.READING}</SelectItem>
                  <SelectItem value="OTHER">{dict.knowledgeGaps.sourceLabels.OTHER}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" disabled={saving || !subjectId || !title}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {dict.common.save}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
