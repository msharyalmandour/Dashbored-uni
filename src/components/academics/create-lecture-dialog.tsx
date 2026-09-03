"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createLecture } from "@/app/actions/academics";

export function CreateLectureDialog({
  subjectId,
  topics,
  nextLectureNumber,
}: {
  subjectId: string;
  topics: { id: string; name: string }[];
  nextLectureNumber: number;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [topicId, setTopicId] = React.useState<string>("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await createLecture({
        subjectId,
        topicId: topicId || undefined,
        title: String(form.get("title")),
        lectureNumber: Number(form.get("lectureNumber")) || nextLectureNumber,
        date: String(form.get("date")),
        lecturer: String(form.get("lecturer") || ""),
      });
      toast.success("Lecture added");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Couldn't create lecture");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Plus className="size-4" /> New Lecture
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Lecture</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input name="title" placeholder="Cardiac Cycle" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Lecture #</Label>
              <Input name="lectureNumber" type="number" defaultValue={nextLectureNumber} min={1} />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
            </div>
          </div>
          {topics.length > 0 && (
            <div className="space-y-1.5">
              <Label>Topic (optional)</Label>
              <Select value={topicId} onValueChange={setTopicId}>
                <SelectTrigger>
                  <SelectValue placeholder="No topic" />
                </SelectTrigger>
                <SelectContent>
                  {topics.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Lecturer</Label>
            <Input name="lecturer" placeholder="Optional" />
          </div>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Create Lecture
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
